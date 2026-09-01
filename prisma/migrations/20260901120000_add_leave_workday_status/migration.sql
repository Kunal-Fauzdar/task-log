-- Add LEAVE to the work-day status enum.
-- Kept in its OWN migration: Postgres will not let a newly-added enum value be *used* in the
-- same transaction it was added in, and Prisma runs each migration file in one transaction.
-- The next migration (add_workday_type) is what actually references/needs this value.
ALTER TYPE "WorkDayStatus" ADD VALUE IF NOT EXISTS 'LEAVE';
