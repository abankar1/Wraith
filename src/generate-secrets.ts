import { randomBytes } from "node:crypto";
console.log(`API_TOKEN=${randomBytes(32).toString("base64url")}`);
console.log(`SESSION_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`);
