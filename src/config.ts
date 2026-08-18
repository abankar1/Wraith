export interface Config {
  host: string;
  port: number;
  targetGroupName: string;
  apiToken: string;
  sessionEncryptionKey: Buffer;
  sessionFile: string;
  maxMessageLength: number;
  rateLimitPerMinute: number;
  logLevel: string;
}

function positiveInt(name: string, value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiToken = env.API_TOKEN ?? "";
  if (Buffer.byteLength(apiToken) < 32) throw new Error("API_TOKEN must be at least 32 bytes");
  const key = Buffer.from(env.SESSION_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("SESSION_ENCRYPTION_KEY must decode to exactly 32 bytes");
  const targetGroupName = env.TARGET_GROUP_NAME?.trim() ?? "";
  if (!targetGroupName) throw new Error("TARGET_GROUP_NAME is required");

  return {
    host: env.HOST ?? "127.0.0.1",
    port: positiveInt("PORT", env.PORT, 8787),
    targetGroupName,
    apiToken,
    sessionEncryptionKey: key,
    sessionFile: env.SESSION_FILE ?? "./data/session.enc",
    maxMessageLength: positiveInt("MAX_MESSAGE_LENGTH", env.MAX_MESSAGE_LENGTH, 1000),
    rateLimitPerMinute: positiveInt("RATE_LIMIT_PER_MINUTE", env.RATE_LIMIT_PER_MINUTE, 10),
    logLevel: env.LOG_LEVEL ?? "info"
  };
}
