-- Phase 10 (Security & Hardening) — spec's "database constraints" review item. These mirror
-- invariants already enforced at the Zod/domain layer (CLAUDE.md §5), added here as
-- defense-in-depth: a bug in application code should not be able to write impossible data.
-- Prisma's schema.prisma has no native `@check` attribute, so these are hand-written rather than
-- generated from the schema — keep them in sync with §5 by hand if that section ever changes.

-- WorkDay: breakSeconds is an accumulated duration, never negative.
ALTER TABLE "work_days" ADD CONSTRAINT "work_days_breakSeconds_nonnegative" CHECK ("breakSeconds" >= 0);

-- WorkDay: Check Out must be after Check In on the same day (CLAUDE.md §5 — overnight shifts are
-- out of scope for v1, so this is a strict same-day ordering, not just "not before").
ALTER TABLE "work_days" ADD CONSTRAINT "work_days_checkOut_after_checkIn" CHECK ("checkIn" IS NULL OR "checkOut" IS NULL OR "checkOut" > "checkIn");

-- Task: durationSeconds accumulates completed elapsed time, never negative.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_durationSeconds_nonnegative" CHECK ("durationSeconds" >= 0);

-- Skill: proficiencyPercentage drives category derivation (CLAUDE.md §5) and must stay in [0, 100].
ALTER TABLE "skills" ADD CONSTRAINT "skills_proficiencyPercentage_range" CHECK ("proficiencyPercentage" BETWEEN 0 AND 100);

-- SkillHistory: same [0, 100] invariant on the before/after values it logs.
ALTER TABLE "skill_history" ADD CONSTRAINT "skill_history_fromPercentage_range" CHECK ("fromPercentage" BETWEEN 0 AND 100);
ALTER TABLE "skill_history" ADD CONSTRAINT "skill_history_toPercentage_range" CHECK ("toPercentage" BETWEEN 0 AND 100);
