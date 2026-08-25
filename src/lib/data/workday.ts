import { prisma } from "@/lib/db";
import { Prisma } from "../../generated/prisma/client.ts";
import { tolerateAlreadyDeleted } from "@/lib/data/shared";
import { deriveWorkDayStatus } from "@/lib/domain/workday";

export function createWorkDay(data: { date: Date; notes?: string }) {
  return prisma.workDay.create({ data });
}

// Not in the original spec's WorkDay CRUD requirements (§7/§16/Phase 3 only ever asked for
// create/edit) — added in Phase 11 because the QA checklist listed "delete work day" by
// parallelism with Task delete, and the user confirmed it should exist. Tasks cascade-delete
// with it (schema.prisma: onDelete: Cascade). Uses tolerateAlreadyDeleted like every other
// id-keyed mutation (CLAUDE.md §3) — a double-click or concurrent delete must not crash.
export function deleteWorkDay(id: string) {
  return tolerateAlreadyDeleted(prisma.workDay.delete({ where: { id } }));
}

export function getWorkDayByDate(date: Date) {
  return prisma.workDay.findUnique({
    where: { date },
    include: {
      tasks: {
        orderBy: { order: "asc" },
        include: { skills: { include: { skill: true } } },
      },
    },
  });
}

export function listWorkDays(range?: { from: Date; to: Date }) {
  return prisma.workDay.findMany({
    where: range ? { date: { gte: range.from, lte: range.to } } : undefined,
    orderBy: { date: "desc" },
    include: { tasks: true },
  });
}

// For the Dashboard's "Recent Work Days" (spec §14). Excludes WorkDay rows with no real
// activity (NOT_STARTED, no tasks, not a holiday) — visiting a future date's /worklog/[date]
// auto-creates an empty row (see findOrCreateWorkDayByDate), and those shouldn't clutter a
// "recent work" list.
export function getRecentWorkDays(limit: number) {
  return prisma.workDay.findMany({
    where: {
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
// Two concurrent requests for the same new date (e.g. Next.js's separate document + RSC-flight
// requests for one page load, or two browser tabs opened at once) can both attempt to create
// it. `upsert` alone isn't enough here — caught via manual browser verification in Phase 3: it
// can still surface the underlying unique-constraint violation as a
// PrismaClientKnownRequestError (P2002) rather than silently resolving, depending on how the
// connector executes it. On P2002 we treat it as "someone else just created it" and re-fetch.
// A bounded retry also covers rarer transient errors from the pooled/serverless Neon
// connection (observed under concurrency-stress testing as occasional slow failures, not a
// logic bug) — findOrCreateWorkDayByDate is naturally idempotent, so retrying is safe.
export async function findOrCreateWorkDayByDate(
  date: Date,
  attemptsRemaining = FIND_OR_CREATE_MAX_ATTEMPTS,
) {
  try {
    return await prisma.workDay.upsert({
      where: { date },
      create: { date },
      update: {},
      include: {
      tasks: {
        orderBy: { order: "asc" },
        include: { skills: { include: { skill: true } } },
      },
    },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await getWorkDayByDate(date);
      if (existing) return existing;
    }
    if (attemptsRemaining > 1) {
      return findOrCreateWorkDayByDate(date, attemptsRemaining - 1);
    }
    throw error;
  }
}

export async function updateWorkDay(
  id: string,
  data: { notes?: string; isHoliday?: boolean; holidayReason?: string | null },
) {
  const current = await prisma.workDay.findUniqueOrThrow({ where: { id } });
  const isHoliday = data.isHoliday ?? current.isHoliday;

  return prisma.workDay.update({
    where: { id },
    data: {
      ...data,
      status: deriveWorkDayStatus({ checkIn: current.checkIn, checkOut: current.checkOut, isHoliday }),
    },
  });
}

// "Start Work" (spec §9). `checkInAt` must be captured client-side as a naive-local time (see
// src/lib/domain/date.ts getNaiveLocalNow) — never stamped server-side, or it would record the
// server's timezone instead of the user's.
export async function startWork(id: string, checkInAt: Date) {
  const current = await prisma.workDay.findUniqueOrThrow({ where: { id } });
  return prisma.workDay.update({
    where: { id },
    data: {
      checkIn: checkInAt,
      status: deriveWorkDayStatus({ checkIn: checkInAt, checkOut: current.checkOut, isHoliday: current.isHoliday }),
    },
  });
}

// "End Work" (spec §9). If a break is still active, folds it into breakSeconds first rather
// than leaving an orphaned breakStartedAt (spec §10: "ensure [manual + start/end break] cannot
// produce conflicting values") — checking out implicitly ends any in-progress break.
//
// The break-elapsed calculation deliberately uses the server's real clock (Date.now()), not
// checkOutAt: breakStartedAt is always a real-time value (see startBreak), while checkOutAt is
// a naive-local time tied to the WorkDay's own date (see CLAUDE.md §3). Those live on different
// "epochs" whenever checkOutAt's date isn't truly the current moment — subtracting one from the
// other produced a multi-decade elapsed value that overflowed Postgres's integer column, caught
// by an integration test using a far-future WorkDay date. In real usage "End Work" is only ever
// offered for today's page, so checkOutAt and Date.now() would already coincide — but the
// function itself needs to be correct independent of that UI-level guarantee.
export async function endWork(id: string, checkOutAt: Date) {
  const current = await prisma.workDay.findUniqueOrThrow({ where: { id } });

  let breakSeconds = current.breakSeconds;
  if (current.breakStartedAt) {
    const elapsed = Math.max(
      0,
      Math.round((Date.now() - current.breakStartedAt.getTime()) / 1000),
    );
    breakSeconds += elapsed;
  }

  return prisma.workDay.update({
    where: { id },
    data: {
      checkOut: checkOutAt,
      breakSeconds,
      breakStartedAt: null,
      status: deriveWorkDayStatus({ checkIn: current.checkIn, checkOut: checkOutAt, isHoliday: current.isHoliday }),
    },
  });
}

// Break start/end use the server's own clock (unlike checkIn/checkOut, breakStartedAt is never
// displayed as a clock-face time — only the elapsed *difference* is ever used — so there's no
// naive-local-encoding concern here; see CLAUDE.md §3).
export function startBreak(id: string) {
  return prisma.workDay.update({ where: { id }, data: { breakStartedAt: new Date() } });
}

export async function endBreak(id: string) {
  const current = await prisma.workDay.findUniqueOrThrow({ where: { id } });
  if (!current.breakStartedAt) return current;

  const elapsed = Math.max(
    0,
    Math.round((Date.now() - current.breakStartedAt.getTime()) / 1000),
  );

  return prisma.workDay.update({
    where: { id },
    data: {
      breakSeconds: current.breakSeconds + elapsed,
      breakStartedAt: null,
    },
  });
}

// Manual correction path (spec §9: "allow manual editing because historical records may need
// to be entered"). `checkIn`/`checkOut` are already-combined naive-local Date values (see
// combineDateAndTime) or null to clear them.
export async function updateWorkDayTimes(
  id: string,
  data: { checkIn: Date | null; checkOut: Date | null; breakSeconds: number },
) {
  const current = await prisma.workDay.findUniqueOrThrow({ where: { id } });
  return prisma.workDay.update({
    where: { id },
    data: {
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      breakSeconds: data.breakSeconds,
      status: deriveWorkDayStatus({
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        isHoliday: current.isHoliday,
      }),
    },
  });
}
