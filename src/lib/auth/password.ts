import { compare } from "bcryptjs";

// The password itself is never stored anywhere (spec §38: "never store passwords in plain
// text") — only its bcrypt hash, in the AUTH_PASSWORD_HASH env var (see scripts/hash-password.ts
// to generate one). Single shared credential, no user table (CLAUDE.md §3).
//
// AUTH_PASSWORD_HASH is stored base64-encoded, not as the raw "$2b$12$..." string. Next.js's
// own .env loader (@next/env, via dotenv-expand) treats "$" as shell-style variable-expansion
// syntax and silently mangles a raw bcrypt hash into garbage — confirmed neither `$$` escaping
// nor quoting reliably prevents it. Base64 has no "$" in its alphabet, so it passes through
// untouched regardless of dotenv-expand's exact escaping behavior.
export async function verifyPassword(candidate: string): Promise<boolean> {
  const encoded = process.env.AUTH_PASSWORD_HASH;
  if (!encoded) return false; // fail closed if misconfigured, never fall through to "authenticated"

  let hash: string;
  try {
    hash = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }
  if (!hash.startsWith("$2")) return false; // not a real bcrypt hash — misconfigured, fail closed

  return compare(candidate, hash);
}
