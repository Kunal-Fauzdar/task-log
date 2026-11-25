import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Symmetric encryption for secrets stored in the DB (Google refresh tokens). Key is derived from
// SESSION_SECRET with a purpose label, so there's no extra env var — but rotating SESSION_SECRET
// also invalidates stored tokens (users just reconnect Google).
function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHash("sha256").update(`worklog:google-token:${secret}`).digest();
}

// Output: "<iv>.<authTag>.<ciphertext>", each base64url. AES-256-GCM (authenticated).
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString("base64url")).join(".");
}

// Null on anything tampered/undecryptable (e.g. after a SESSION_SECRET rotation) — never throws.
export function decryptSecret(value: string): string | null {
  try {
    const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
    if (!iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
