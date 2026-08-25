import { Prisma } from "../../generated/prisma/client.ts";

// Any mutation keyed by an existing record's id can race against that same record being
// deleted concurrently (P2025 "record not found"). Reproduced via Playwright for both Task and
// Skill mutations: editing a record and then deleting it shortly after — even sequentially,
// well outside any obvious click race — occasionally left a *delayed* duplicate update landing
// after the delete had already committed. The exact trigger wasn't pinned down further (never
// reproduced in isolation, only as part of a longer test run), but the fix doesn't depend on
// knowing why: any mutation targeting a specific record by id should be idempotent-safe against
// "it's already gone" rather than crash-logging an unhandled Prisma error — the same reasoning
// as findOrCreateWorkDayByDate's P2002 handling in src/lib/data/workday.ts.
export async function tolerateAlreadyDeleted<T>(operation: Promise<T>): Promise<T | null> {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
