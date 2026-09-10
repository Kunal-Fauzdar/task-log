// @vitest-environment node
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createUser, getUserByEmail, updateUserName, updateUserPassword } from "@/lib/data/user";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createWorkDay, listWorkDays } from "@/lib/data/workday";
import { createTestUser, deleteTestUser } from "@/test/helpers/user";

const created: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created.splice(0) } } });
});

async function track<T extends { id: string }>(user: T): Promise<T> {
  created.push(user.id);
  return user;
}

describe("user data layer", () => {
  it("creates a user and finds it by email", async () => {
    const email = `it-${randomUUID()}@test.local`;
    const user = await track(
      await createUser({ email, name: "Test", passwordHash: await hashPassword("password123") }),
    );

    const found = await getUserByEmail(email);
    expect(found?.id).toBe(user.id);
    expect(await verifyPassword("password123", found!.passwordHash)).toBe(true);
  });

  it("rejects a duplicate email (P2002)", async () => {
    const email = `it-${randomUUID()}@test.local`;
    await track(await createUser({ email, name: "A", passwordHash: "x" }));
    await expect(createUser({ email, name: "B", passwordHash: "y" })).rejects.toThrow();
  });

  it("updates name and password", async () => {
    const user = await track(await createTestUser());
    await updateUserName(user.id, "Renamed");
    await updateUserPassword(user.id, await hashPassword("newpassword1"));

    const found = await getUserByEmail(user.email);
    expect(found?.name).toBe("Renamed");
    expect(await verifyPassword("newpassword1", found!.passwordHash)).toBe(true);
  });
});

describe("per-user data isolation", () => {
  it("one user's list queries never see another user's rows", async () => {
    const a = await track(await createTestUser());
    const b = await track(await createTestUser());
    const date = new Date("2099-02-02");

    await createWorkDay({ userId: a.id, date });
    await createWorkDay({ userId: b.id, date }); // same date, different owner — allowed

    const aDays = await listWorkDays(a.id, { from: date, to: date });
    const bDays = await listWorkDays(b.id, { from: date, to: date });

    expect(aDays).toHaveLength(1);
    expect(bDays).toHaveLength(1);
    expect(aDays[0].id).not.toBe(bDays[0].id);
  });

  it("deleting a user cascades away all their data", async () => {
    const user = await createTestUser();
    const date = new Date("2099-02-03");
    const day = await createWorkDay({ userId: user.id, date });

    await deleteTestUser(user.id);

    expect(await prisma.workDay.findUnique({ where: { id: day.id } })).toBeNull();
  });
});
