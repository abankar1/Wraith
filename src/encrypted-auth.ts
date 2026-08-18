import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { initAuthCreds, BufferJSON, type AuthenticationState, type SignalDataTypeMap } from "@whiskeysockets/baileys";

type StoredState = { creds: AuthenticationState["creds"]; keys: Record<string, Record<string, unknown>> };

export async function useEncryptedAuthState(file: string, key: Buffer): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  let stored: StoredState = { creds: initAuthCreds(), keys: {} };
  try {
    const envelope = JSON.parse(await readFile(file, "utf8")) as { iv: string; tag: string; ciphertext: string };
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
    stored = JSON.parse(plain.toString("utf8"), BufferJSON.reviver) as StoredState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Could not decrypt session state", { cause: error });
  }

  let writeChain = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(async () => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const plain = Buffer.from(JSON.stringify(stored, BufferJSON.replacer));
      const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
      const envelope = JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") });
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      const temp = `${file}.tmp`;
      await writeFile(temp, envelope, { mode: 0o600 });
      await chmod(temp, 0o600);
      await rename(temp, file);
    });
    return writeChain;
  };

  const state: AuthenticationState = {
    creds: stored.creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const bucket = stored.keys[type] ?? {};
        return Object.fromEntries(ids.filter((id) => bucket[id] !== undefined).map((id) => [id, bucket[id]])) as { [id: string]: SignalDataTypeMap[T] };
      },
      set: async (data) => {
        for (const [type, entries] of Object.entries(data)) {
          const bucket = (stored.keys[type] ??= {});
          for (const [id, value] of Object.entries(entries ?? {})) value == null ? delete bucket[id] : bucket[id] = value;
        }
        await persist();
      }
    }
  };
  return { state, saveCreds: persist };
}
