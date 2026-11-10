// Passwords (scrypt), single-use secrets and fingerprints. None of this is stored in plain text in the database.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384, R = 8, P = 1, LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 10;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, LENGTH, { N: n, r, p }, (e, k) => (e ? reject(e) : resolve(k))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const k = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), k.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [algorithm, n, r, p, salt, k] = String(stored || "").split("$");
  if (algorithm !== "scrypt" || !salt || !k) return false;
  const expected = Buffer.from(k, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** New secret with a readable prefix, for example "hub_…" for a token or "dev_…" for a device. */
export function newSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

/** SHA-256 fingerprint in hexadecimal: the only thing stored of a session, a token or a device key. */
export function fingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** The first characters, to recognize a secret on screen without showing it. */
export const prefixOf = (secret: string) => `${secret.slice(0, 9)}…`;
