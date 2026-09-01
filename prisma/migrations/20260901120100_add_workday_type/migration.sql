-- New WorkDayType enum + work_days.dayType column, replacing the boolean isHoliday flag.
-- holidayReason is renamed (not dropped/re-added) so existing reason text is preserved.

-- CreateEnum
CREATE TYPE "WorkDayType" AS ENUM ('WORKING', 'HOLIDAY', 'LEAVE');

-- AlterTable: add the new column, defaulting existing rows to WORKING
ALTER TABLE "work_days" ADD COLUMN "dayType" "WorkDayType" NOT NULL DEFAULT 'WORKING';

-- Backfill from the old flag (no rows were ever LEAVE, so only HOLIDAY needs setting)
UPDATE "work_days" SET "dayType" = 'HOLIDAY' WHERE "isHoliday" = true;

-- Rename holidayReason -> dayNote (preserves data)
ALTER TABLE "work_days" RENAME COLUMN "holidayReason" TO "dayNote";

-- Drop the now-redundant flag
ALTER TABLE "work_days" DROP COLUMN "isHoliday";
