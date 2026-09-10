import { prisma } from "@/lib/db";
import { Prisma } from "../../generated/prisma/client.ts";
import { WorkDayType } from "../../generated/prisma/enums.ts";
import { tolerateAlreadyDeleted } from "@/lib/data/shared";
import { deriveWorkDayStatus } from "@/lib/domain/workday";

const TASK_INCLUDE = {
  tasks: {
    orderBy: { order: "asc" },
    include: { skills: { include: { skill: true } } },
  },
} as const;

// Every function is scoped to one owner (`userId`) — a user can only ever read or mutate their
// own work days (CLAUDE.md §3/§4). For a by-id mutation we confirm ownership with a `findFirst`
// on `{ id, userId }` (not a unique selector, so not `findUnique`) and return null when it isn't
// the caller's — the same "record is already gone" contract callers handle from
// tolerateAlreadyDeleted.
function ownedWorkDay(userId: string, id: string) {
  return prisma.workDay.findFirst({ where: { id, userId } });
}

export function createWorkDay(data: { userId: string; date: Date; notes?: string }) {
  return prisma.workDay.create({ data });
}

export async function deleteWorkDay(userId: string, id: string) {
  const current = await ownedWorkDay(userId, id);
  if (!current) return null;
  return tolerateAlreadyDeleted(prisma.workDay.delete({ where: { id } }));
}

export function getWorkDayByDate(userId: string, date: Date) {
  return prisma.workDay.findUnique({
    where: { userId_date: { userId, date } },
    include: TASK_INCLUDE,
  });
}

export function listWorkDays(userId: string, range?: { from: Date; to: Date }) {
  return prisma.workDay.findMany({
    where: { userId, ...(range ? { date: { gte: range.from, lte: range.to } } : {}) },
    orderBy: { date: "desc" },
    include: { tasks: true },
  });
}

// For the Dashboard's "Recent Work Days" (spec §14). Excludes WorkDay rows with no real
// activity (NOT_STARTED, no tasks, not a holiday) — visiting a future date's /worklog/[date]
// auto-creates an empty row (see findOrCreateWorkDayByDate), and those shouldn't clutter a
// "recent work" list.
export function getRecentWorkDays(userId: string, limit: number) {
  return prisma.workDay.findMany({
    where: {
      userId,
      OR: [{ status: { not: "NOT_STARTED" } }, { tasks: { some: {} } }],
    },
    orderBy: { date: "desc" },
    take: limit,
    include: { tasks: true },
  });
}

const FIND_OR_CREATE_MAX_ATTEMPTS = 3;

// The daily-use flow is "open today's page" (spec §17) — it must just work on the first visit
// of a new day rather than 404ing until the user explicitly creates a WorkDay first.
//
// Two concurrent requests for the same new (userId, date) — e.g. Next.js's separate document +
// RSC-flight requests for one page load, or two browser tabs opened at once — can both attempt
// to create it. `upsert` alone isn't enough here (caught via manual browser verification in
// Phase 3): it can still surface the underlying unique-constraint violation as a P2002 rather
// than silently resolving. On P2002 we treat it as "someone else just created it" and re-fetch.
// A bounded retry also covers rarer transient errors from the pooled/serverless Neon connection.
export async function findOrCreateWorkDayByDate(
  userId: string,
  date: Date,
  attemptsRemaining = FIND_OR_CREATE_MAX_ATTEMPTS,
) {
  try {
    return await prisma.workDay.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date },
      update: {},
      include: TASK_INCLUDE,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await getWorkDayByDate(userId, date);
      if (existing) return existing;
    }
    if (attemptsRemaining > 1) {
      return findOrCreateWorkDayByDate(userId, date, attemptsRemaining - 1);
    }
    throw error;
  }
}

export async function updateWorkDay(
  userId: string,
  id: string,
  data: { notes?: string; dayType?: WorkDayType; dayNote?: string | null },
) {
  const current = await ownedWorkDay(userId, id);
  if (!current) return null;
  const dayType = data.dayType ?? current.dayType;

  return tolerateAlreadyDeleted(
    prisma.workDay.update({
      where: { id },
      data: {
        ...data,
        status: deriveWorkDayStatus({
          checkIn: current.checkIn,
          checkOut: current.checkOut,
          dayType,
        }),
      },
    }),
  );
}

// "Start Work" (spec §9). `checkInAt` must be captured client-side as a naive-local time (see
// src/lib/domain/date.ts getNaiveLocalNow) — never stamped server-side, or it would record the
// server's timezone instead of the user's.
export async function startWork(userId: string, id: string, checkInAt: Date) {
  const current = await ownedWorkDay(userId, id);
  if (!current) return null;
  return tolerateAlreadyDeleted(
    prisma.workDay.update({
      where: { id },
      data: {
        checkIn: checkInAt,
        status: deriveWorkDayStatus({
          checkIn: checkInAt,
          checkOut: current.checkOut,
          dayType: current.dayType,
        }),
      },
    }),
  );
}

// "End Work" (spec §9). If a break is still active, folds it into breakSeconds first rather
// than leaving an orphaned breakStartedAt (spec §10). The break-elapsed calculation
// deliberately uses the server's real clock (Date.now()), not checkOutAt: breakStartedAt is
// always a real-time value (see startBreak), while checkOutAt is a naive-local time tied to the
// WorkDay's own date (CLAUDE.md §3). Subtracting across those "clocks" once overflowed
// Postgres's integer column (caught by an integration test using a far-future WorkDay date).
export async function endWork(userId: string, id: string, checkOutAt: Date) {
  const current = await ownedWorkDay(userId, id);
  if (!current) return null;

  let breakSeconds = current.breakSeconds;
  if (current.breakStartedAt) {
    const elapsed = Math.max(
      0,
      Math.round((Date.now() - current.breakStartedAt.getTime()) / 1000),
    );
    breakSeconds += elapsed;
  }

  return tolerateAlreadyDeleted(
    prisma.workDay.update({
      where: { id },
      data: {
        checkOut: checkOutAt,
        breakSeconds,
        breakStartedAt: null,
        status: deriveWorkDayStatus({
          checkIn: current.checkIn,
          checkOut: checkOutAt,
          dayType: current.dayType,
        }),
      },
    }),
  );
}

// Break start/end use the server's own clock (unlike checkIn/checkOut, breakStartedAt is never
// displayed as a clock-face time — only the elapsed *difference* is ever used — CLAUDE.md §3).
export async function startBreak(userId: string, id: string) {
  const current = await ownedWorkDay(userId, id);
  if (!current) return null;
  return tolerateAlreadyDeleted(
    prisma.workDay.update({ where: { id }, data: { breakStartedAt: new Date() } }),
  );
}

export async function endBreak(userId: string, id: string) {
  const current = await ownedWorkDay(userId, id);
  if (!current) return null;
  if (!current.breakStartedAt) return current;

  const elapsed = Math.max(
    0,
    Math.round((Date.now() - current.breakStartedAt.getTime()) / 1000),
  );

  return tolerateAlreadyDeleted(
    prisma.workDay.update({
      where: { id },
      data: {
        breakSeconds: current.breakSeconds + elapsed,
        breakStartedAt: null,
      },
    }),
  );
}

// Manual correction path (spec §9). `checkIn`/`checkOut` are already-combined naive-local Date
// values (see combineDateAndTime) or null to clear them.
export async function updateWorkDayTimes(
  userId: string,
  id: string,
  data: { checkIn: Date | null; checkOut: Date | null; breakSeconds: number },
) {
  const current = await ownedWorkDay(userId, id);
  if (!current) return null;
  return tolerateAlreadyDeleted(
    prisma.workDay.update({
      where: { id },
      data: {
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        breakSeconds: data.breakSeconds,
        status: deriveWorkDayStatus({
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          dayType: current.dayType,
        }),
      },
    }),
  );
}

// Clears all time-tracking fields back to a fresh state, without touching tasks / notes /
// dayType. `status` re-derives to NOT_STARTED (or stays HOLIDAY/LEAVE if the day type forces it).
export async function resetWorkDayTimes(userId: string, id: string) {
  const current = await ownedWorkDay(userId, id);
  if (!current) return null;
  return tolerateAlreadyDeleted(
    prisma.workDay.update({
      where: { id },
      data: {
        checkIn: null,
        checkOut: null,
        breakSeconds: 0,
        breakStartedAt: null,
        status: deriveWorkDayStatus({ checkIn: null, checkOut: null, dayType: current.dayType }),
      },
    }),
  );
}
