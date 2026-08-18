import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { buildServer } from "./server.js";
import { WhatsAppSender } from "./whatsapp.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const sender = new WhatsAppSender(config, logger);
await sender.start();
const server = buildServer(config, sender, logger);
server.listen(config.port, config.host, () => logger.info({ host: config.host, port: config.port }, "API listening"));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
