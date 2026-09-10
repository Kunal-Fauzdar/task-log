import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";

// A throwaway account for integration tests. Deleting it cascades to every WorkDay / Skill /
// Project / Holiday / AppSettings row it owns (schema FKs are ON DELETE CASCADE), so tests can
// clean up by deleting just the user.
export function createTestUser(overrides: { email?: string; name?: string } = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `test-${randomUUID()}@test.local`,
      name: overrides.name ?? "Test User",
      passwordHash: "__TEST__",
    },
  });
}

export async function deleteTestUser(id: string): Promise<void> {
  await prisma.user.deleteMany({ where: { id } });
}
