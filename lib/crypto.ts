// Encryption of connector secrets: AES-256-GCM with a 32-byte key that lives only in the server's
// environment variables (HUB_ENCRYPTION_KEY). Stored format: v1.<iv>.<tag>.<data>, in base64url.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const k = Buffer.from(process.env.HUB_ENCRYPTION_KEY || "", "base64");
  if (k.length !== 32) throw new Error("HUB_ENCRYPTION_KEY must be 32 bytes in base64 (see .env.example)");
  return k;
}

export function encryptionAvailable(): boolean {
  return Buffer.from(process.env.HUB_ENCRYPTION_KEY || "", "base64").length === 32;
}

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(stored: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || data === undefined) throw new Error("Secret in an unknown format");
  const d = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}
