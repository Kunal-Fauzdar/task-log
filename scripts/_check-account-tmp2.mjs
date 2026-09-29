import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

console.log("DATABASE_URL host:", new URL(process.env.DATABASE_URL).hostname);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const tables = await prisma.$queryRaw`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name;
`;
console.log("TABLES:", JSON.stringify(tables));

for (const t of tables) {
  const name = t.table_name;
  const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${name}"`);
  console.log(`${name}: ${count[0].c}`);
}

await prisma.$disconnect();
