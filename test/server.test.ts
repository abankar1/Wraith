import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "../src/logger.js";
import { buildServer, type Sender } from "../src/server.js";
import type { Config } from "../src/config.js";

const config: Config = { host: "127.0.0.1", port: 0, targetGroupName: "x", apiToken: "a".repeat(32), sessionEncryptionKey: Buffer.alloc(32), sessionFile: "x", maxMessageLength: 20, rateLimitPerMinute: 10, logLevel: "silent" };
const sender: Sender = { status: () => ({ connected: true, targetResolved: true }), send: async () => "message-1" };

test("only authenticated, valid messages are accepted", async () => {
  const server = buildServer(config, sender, createLogger("silent"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/v1/messages`;
  const denied = await fetch(url, { method: "POST", body: JSON.stringify({ text: "hello" }) });
  assert.equal(denied.status, 401);
  const accepted = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${config.apiToken}`, "content-type": "application/json" }, body: JSON.stringify({ text: "hello" }) });
  assert.equal(accepted.status, 202);
  assert.equal((await accepted.json() as { messageId: string }).messageId, "message-1");
  server.close();
});
