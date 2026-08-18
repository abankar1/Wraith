import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, type WASocket } from "@whiskeysockets/baileys";
import TerminalQRCode from "qrcode-terminal";
import { createLogger, type Logger } from "./logger.js";
import { useEncryptedAuthState } from "./encrypted-auth.js";
import type { Config } from "./config.js";

export class WhatsAppSender {
  private socket?: WASocket;
  private groupJid?: string;
  private connected = false;
  private reconnecting = false;

  constructor(private readonly config: Config, private readonly logger: Logger) {}

  async start(): Promise<void> {
    const { state, saveCreds } = await useEncryptedAuthState(this.config.sessionFile, this.config.sessionEncryptionKey);
    const { version } = await fetchLatestBaileysVersion();
    const socket = makeWASocket({
      auth: state,
      version,
      logger: createLogger("silent"),
      browser: ["Wraith", "Desktop", "0.1.0"],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    });
    this.socket = socket;
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.logger.info("Scan this QR in WhatsApp: Settings → Linked devices → Link a device");
        TerminalQRCode.generate(qr, { small: true });
      }
      if (connection === "open") {
        this.connected = true;
        this.reconnecting = false;
        await this.resolveTarget();
        this.logger.info({ targetGroupName: this.config.targetGroupName }, "WhatsApp sender ready");
      }
      if (connection === "close") {
        this.connected = false;
        this.groupJid = undefined;
        const status = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
        if (status === DisconnectReason.loggedOut) {
          this.logger.error("WhatsApp logged out. Remove the encrypted session file and pair again.");
        } else if (!this.reconnecting) {
          this.reconnecting = true;
          this.logger.warn({ status }, "WhatsApp disconnected; reconnecting");
          setTimeout(() => void this.start().catch((error) => this.logger.error({ error }, "Reconnect failed")), 2000);
        }
      }
    });
  }

  private async resolveTarget(): Promise<void> {
    if (!this.socket) throw new Error("WhatsApp socket unavailable");
    const groups = await this.socket.groupFetchAllParticipating();
    const matches = Object.values(groups).filter((group) => group.subject === this.config.targetGroupName);
    if (matches.length !== 1) throw new Error(`Expected exactly one group named ${JSON.stringify(this.config.targetGroupName)}; found ${matches.length}`);
    this.groupJid = matches[0]!.id;
  }

  status(): { connected: boolean; targetResolved: boolean } {
    return { connected: this.connected, targetResolved: Boolean(this.groupJid) };
  }

  async send(text: string): Promise<string> {
    if (!this.connected || !this.socket || !this.groupJid) throw new Error("WhatsApp is not ready");
    const result = await this.socket.sendMessage(this.groupJid, { text });
    return result?.key.id ?? "sent";
  }
}
