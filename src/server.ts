import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Logger } from "./logger.js";
import type { Config } from "./config.js";

export interface Sender { status(): { connected: boolean; targetResolved: boolean }; send(text: string): Promise<string> }

function reply(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(json), "cache-control": "no-store" });
  res.end(json);
}

function authenticated(req: IncomingMessage, expected: string): boolean {
  const supplied = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? "";
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function readJson(req: IncomingMessage, maxBytes = 16_384): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function buildServer(config: Config, sender: Sender, logger: Logger) {
  const attempts: number[] = [];
  return createServer(async (req, res) => {
    const requestId = String(req.headers["x-request-id"] ?? crypto.randomUUID()).slice(0, 128);
    try {
      if (req.method === "GET" && req.url === "/healthz") return reply(res, 200, { ok: true });
      if (req.method === "GET" && req.url === "/readyz") {
        const status = sender.status();
        return reply(res, status.connected && status.targetResolved ? 200 : 503, status);
      }
      if (req.method !== "POST" || req.url !== "/v1/messages") return reply(res, 404, { error: "not_found", requestId });
      if (!authenticated(req, config.apiToken)) return reply(res, 401, { error: "unauthorized", requestId });

      const now = Date.now();
      while (attempts[0] && attempts[0] < now - 60_000) attempts.shift();
      if (attempts.length >= config.rateLimitPerMinute) return reply(res, 429, { error: "rate_limited", requestId });
      attempts.push(now);

      const body = await readJson(req) as { text?: unknown };
      if (typeof body.text !== "string" || !body.text.trim()) return reply(res, 400, { error: "text_required", requestId });
      if (body.text.length > config.maxMessageLength) return reply(res, 400, { error: "text_too_long", requestId });
      const messageId = await sender.send(body.text);
      logger.info({ requestId, messageId, textLength: body.text.length }, "Message sent");
      return reply(res, 202, { accepted: true, messageId, requestId });
    } catch (error) {
      logger.error({ requestId, error }, "Request failed");
      return reply(res, 503, { error: "send_unavailable", requestId });
    }
  });
}
