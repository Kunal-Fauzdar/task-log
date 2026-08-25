import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI (migrate, db seed, studio) needs a direct, non-pooled connection —
// Neon's pooled connection doesn't support the session/DDL behavior migrations need.
// Runtime queries use DATABASE_URL (pooled) instead, via the adapter in src/lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
