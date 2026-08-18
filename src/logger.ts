export interface Logger {
  level: string;
  child(bindings: Record<string, unknown>): Logger;
  trace(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, silent: 100 } as const;
const REDACTED_KEYS = new Set(["authorization", "apitoken", "sessionencryptionkey"]);

function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(val, seen);
    }
    return out;
  }
  return value;
}

function write(level: keyof typeof LEVELS, bindings: Record<string, unknown>, first: unknown, second: string | undefined): void {
  const obj = typeof first === "string" ? undefined : first;
  const msg = typeof first === "string" ? first : second;
  const entry = {
    level,
    time: new Date().toISOString(),
    ...bindings,
    ...(obj ? (redact(obj) as Record<string, unknown>) : {}),
    ...(msg ? { msg } : {})
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export function createLogger(level: string, bindings: Record<string, unknown> = {}): Logger {
  const threshold = LEVELS[level as keyof typeof LEVELS] ?? LEVELS.info;
  const make = (name: Exclude<keyof typeof LEVELS, "silent">) => (obj: unknown, msg?: string) => {
    if (LEVELS[name] < threshold) return;
    write(name, bindings, obj, msg);
  };
  return {
    level,
    child: (childBindings) => createLogger(level, { ...bindings, ...childBindings }),
    trace: make("trace"),
    debug: make("debug"),
    info: make("info"),
    warn: make("warn"),
    error: make("error")
  };
}
