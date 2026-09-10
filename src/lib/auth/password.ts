import { compare, hash } from "bcryptjs";

// Passwords are never stored in plain text (spec §38) — only a bcrypt hash, per user, in
// User.passwordHash. Cost 12, same as the single-shared-password era. The hash lives in the
// database now (not an env var), so the old base64-encode dance to survive Next's dotenv-expand
// "$" mangling is gone.
const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_COST);
}

// Fails closed on a missing / non-bcrypt hash (e.g. the "__RESET_REQUIRED__" sentinel the
// migration seeds for the pre-existing owner account) rather than throwing.
export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash || !passwordHash.startsWith("$2")) return false;
  return compare(plain, passwordHash);
}
