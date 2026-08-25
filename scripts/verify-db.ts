import "dotenv/config";
import { prisma } from "../src/lib/db.ts";

async function main() {
  const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
  console.log("Database connection OK:", result);
}

main()
  .catch((error) => {
    console.error("Database connection FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
