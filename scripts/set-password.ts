import "dotenv/config";

import { hashPassword } from "../src/lib/auth/password.ts";
import { prisma } from "../src/lib/db.ts";

// Sets (or resets) a user's password directly in the database.
//
//   npx tsx scripts/set-password.ts <email> '<new-password>'
//
// Used once after the multi-user migration to give the backfilled "owner" account
// (kavya.b.analyst@gmail.com, seeded with a sentinel hash) a real password — that email can't
// self-register because it already exists. Also handy for an admin-style password reset.
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/set-password.ts <email> '<new-password>'");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("Choose a password of at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  console.log(`Password updated for ${email} (${user.name}).`);
}

main()
  .catch((error) => {
    console.error("Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
