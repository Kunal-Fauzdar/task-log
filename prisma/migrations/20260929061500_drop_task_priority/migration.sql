-- Task priority was removed again; the column only ever held the default value.
ALTER TABLE "tasks" DROP COLUMN "priority";
DROP TYPE "TaskPriority";
