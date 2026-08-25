import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";

// Next.js loads .env itself, so this is a no-op there — but anything that imports this module
// outside of Next (Playwright specs, ad-hoc scripts) doesn't get .env for free, and this file
// reads process.env.DATABASE_URL at import time. dotenv never overwrites already-set vars, so
// this is safe to run redundantly.

// Pooled connection (has "-pooler" in the hostname) — safe for the many short-lived
// connections a serverless/Next.js app opens under real traffic.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
