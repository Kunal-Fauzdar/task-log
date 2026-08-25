import { randomBytes } from "node:crypto";

import { hash } from "bcryptjs";

// Run with: npx tsx scripts/hash-password.ts 'your-chosen-password'
//
// Prints an AUTH_PASSWORD_HASH value (and, the first time, a SESSION_SECRET) to paste into
// .env / Vercel env vars. The plaintext password is never written to a file — it only ever
// exists in your shell history and this command's stdout.
async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: npx tsx scripts/hash-password.ts 'your-chosen-password'");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("Choose a password of at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hash(password, 12);
  // base64-encoded, not the raw "$2b$12$..." string — Next.js's .env loader (@next/env, via
  // dotenv-expand) treats "$" as variable-expansion syntax and silently mangles a raw bcrypt
  // hash; see src/lib/auth/password.ts for the full explanation.
  const encoded = Buffer.from(passwordHash, "utf8").toString("base64");
  console.log(`AUTH_PASSWORD_HASH="${encoded}"`);

  if (!process.env.SESSION_SECRET) {
    console.log(`SESSION_SECRET="${randomBytes(32).toString("hex")}"`);
  }
}

main();
