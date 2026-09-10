-- Multi-user: introduces `users` and makes every domain table owned by a User (userId).
-- The app was single-user until now (CLAUDE.md §1/§3), so existing rows are backfilled to one
-- "owner" account before userId is made NOT NULL.

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Owner account for all pre-existing data. The passwordHash is a sentinel that no bcrypt.compare
-- can match — set a real password with:  npx tsx scripts/set-password.ts kavya.b.analyst@gmail.com '<password>'
INSERT INTO "users" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt")
VALUES ('usrowner000000000000000000', 'kavya.b.analyst@gmail.com', 'Kavya', '__RESET_REQUIRED__', now(), now());

-- AlterTable: add nullable userId, backfill to the owner, then enforce NOT NULL
ALTER TABLE "work_days" ADD COLUMN "userId" TEXT;
UPDATE "work_days" SET "userId" = 'usrowner000000000000000000' WHERE "userId" IS NULL;
ALTER TABLE "work_days" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "skills" ADD COLUMN "userId" TEXT;
UPDATE "skills" SET "userId" = 'usrowner000000000000000000' WHERE "userId" IS NULL;
ALTER TABLE "skills" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "projects" ADD COLUMN "userId" TEXT;
UPDATE "projects" SET "userId" = 'usrowner000000000000000000' WHERE "userId" IS NULL;
ALTER TABLE "projects" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "holidays" ADD COLUMN "userId" TEXT;
UPDATE "holidays" SET "userId" = 'usrowner000000000000000000' WHERE "userId" IS NULL;
ALTER TABLE "holidays" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "app_settings" ADD COLUMN "userId" TEXT;
UPDATE "app_settings" SET "userId" = 'usrowner000000000000000000' WHERE "userId" IS NULL;
ALTER TABLE "app_settings" ALTER COLUMN "userId" SET NOT NULL;
-- was `@default("singleton")` for the single-row era; new rows get a cuid from Prisma Client now
ALTER TABLE "app_settings" ALTER COLUMN "id" DROP DEFAULT;

-- DropIndex: the old app-wide unique constraints become per-user
DROP INDEX "work_days_date_key";
DROP INDEX "skills_name_key";
DROP INDEX "projects_name_key";
DROP INDEX "holidays_date_key";

-- CreateIndex: per-user uniqueness + FK lookup indexes
CREATE INDEX "work_days_userId_idx" ON "work_days"("userId");
CREATE UNIQUE INDEX "work_days_userId_date_key" ON "work_days"("userId", "date");
CREATE INDEX "skills_userId_idx" ON "skills"("userId");
CREATE UNIQUE INDEX "skills_userId_name_key" ON "skills"("userId", "name");
CREATE INDEX "projects_userId_idx" ON "projects"("userId");
CREATE UNIQUE INDEX "projects_userId_name_key" ON "projects"("userId", "name");
CREATE INDEX "holidays_userId_idx" ON "holidays"("userId");
CREATE UNIQUE INDEX "holidays_userId_date_key" ON "holidays"("userId", "date");
CREATE UNIQUE INDEX "app_settings_userId_key" ON "app_settings"("userId");

-- AddForeignKey
ALTER TABLE "work_days" ADD CONSTRAINT "work_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "skills" ADD CONSTRAINT "skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
