# WorkLog Manager — Project Memory

Source of truth for architecture, conventions, and phase progress. Read this before making
any structural change. Keep it updated at the end of every phase.

## 1. Purpose

A personal productivity app for **one user** (Kavya) to:
- Log daily work: check-in/out, breaks, and per-task entries (Task ID, description, duration, link).
- Track skill proficiency (SkillMap) across three bands: <30%, 30–70%, >70%.
- Export logs to an `.xlsx` file matching a required submission format (exact columns, merged
  work-day cells, holiday rows, hyperlinks).

This is **not** a multi-tenant SaaS product. No org/team features. Optimize for daily,
repeated, low-friction use over configurability.

## 2. Tech Stack (decided in Phase 0)

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript + React | Server Components for read-heavy pages, Server Actions for mutations, one deploy target |
| Styling | Tailwind CSS | Fast iteration, no separate CSS files to keep in sync |
| Components | shadcn/ui (Radix primitives) | Accessible by default, no runtime component-lib bloat, fully editable |
| Database | **Neon Postgres**, provisioned via the Vercel-Neon marketplace integration — no local Postgres/Docker on this machine | User already created it this way; connection strings are plain `postgres://`, so standard-Postgres-compatible — provider can change later without app-logic changes |
| ORM | Prisma **7** (`prisma@7.9.1`) with `@prisma/adapter-neon` driver adapter | Type-safe queries, migrations, good DX with Postgres. v7 requires a driver adapter for every database — see §3 |
| Validation | Zod | Shared client/server validation, parses Server Action & API input |
| Excel | ExcelJS | Only library in this space with real merged-cell, styling, and hyperlink support (not just CSV) |
| Dates/time | Hand-written date/duration utils (`src/lib/domain/date.ts`, `duration.ts`) | Lightweight; duration and naive-local-date math turned out simple enough not to need a library. `date-fns` was the original Phase 0 pick but was never actually called anywhere by the time Phase 11 QA checked — removed then, see CLAUDE.md §3 |
| Unit/Integration tests | Vitest | Fast, native ESM/TS, good for pure-function + Prisma integration tests |
| E2E tests | Playwright | Real browser coverage of the daily workflow and export |
| Package manager | npm | Only package manager present on this machine (no pnpm/yarn found) |

No state-management library (Redux/Zustand/React Query) is added by default — Server
Components + Server Actions + `revalidatePath` cover the CRUD flows; local `useState`/interval
handles live-ticking timers. Add a client data-fetching library later only if a concrete need
appears (e.g. cross-tab timer sync).

## 3. Key Architectural Decisions & Open Items

- **Database: Neon Postgres, two connection strings, configured the Prisma 7 way.** Provisioned
  via the Vercel-Neon integration, which names the vars `DATABASE_URL` (pooled, hostname has
  `-pooler`) and `DATABASE_URL_UNPOOLED` (direct). We kept those exact names rather than
  renaming to `DIRECT_URL`, so Vercel's integration can auto-sync them into every deploy
  environment without manual copying.
  **Prisma 7 (released after the Phase 0 plan was written) removed `url`/`directUrl`/
  `shadowDatabaseUrl` from the `schema.prisma` datasource block entirely** and now requires a
  driver adapter for every database:
  - `prisma.config.ts` (repo root) holds `datasource.url = env("DATABASE_URL_UNPOOLED")` —
    this is what the Prisma CLI (`migrate dev`/`migrate deploy`/`db seed`/Studio) reads.
  - `src/lib/db.ts` builds the runtime client with `@prisma/adapter-neon`
    (`PrismaNeon({ connectionString: process.env.DATABASE_URL })`) — pooled, safe for
    serverless/many-short-lived-connections traffic.
  - `prisma/schema.prisma`'s `datasource` block has **no `url` field at all**; generator is
    `provider = "prisma-client"` with `output = "../src/generated/prisma"` (gitignored,
    regenerated via `postinstall: prisma generate`).
  - Generated client imports use explicit `.ts` extensions internally (e.g.
    `./enums.ts`) — this requires `moduleResolution: "bundler"` +
    `allowImportingTsExtensions: true` in `tsconfig.json`, already set.
  - `@prisma/client` is still a required runtime dependency even under the new
    `prisma-client` generator (the generated code imports
    `@prisma/client/runtime/client` internally) — don't assume it's removable.
  Verified end-to-end with `npm run db:verify` (`SELECT 1` through the pooled adapter) and
  `npx prisma migrate dev` (through the direct connection via `prisma.config.ts`). Full
  walkthrough in `DEPLOYMENT.md`.
- **Two deliberate version pins below "latest," for ecosystem-compatibility reasons — don't
  blindly bump these without re-checking peer ranges:**
  - `typescript@6.0.3`, not the newly-released `7.x` — `typescript-eslint@8.67.0` (pulled in by
    `eslint-config-next`) caps its peer range at `<6.1.0`. TS 7 itself works fine standalone
    (`tsc --noEmit` was clean under it), but the ESLint TS parser doesn't support it yet.
  - `eslint@9.39.5` (latest ESLint 9, the "maintenance" dist-tag), not `eslint@10.x` —
    `eslint-config-next`'s own plugin chain (`eslint-plugin-import`/`jsx-a11y`/`react`) caps at
    ESLint `^9`.
  Revisit both once `eslint-config-next`/`typescript-eslint` publish versions supporting the
  newer majors.
- **Next.js 16 auto-generates an "agent rules" block appended to `CLAUDE.md` on every
  `next dev` run** (a new built-in feature, unrelated to us). Disabled via `agentRules: false`
  in `next.config.ts` — this file is our own hand-maintained memory, not Next's.
- **Next.js's `middleware.ts` file convention was renamed to `proxy.ts` partway through the 16.x
  line** (dev server prints a deprecation warning naming the exact codemod). Our auth gate
  (Phase 10) lives at `src/proxy.ts`, exporting `proxy(request)` rather than `middleware(request)`
  — the file, the exported function name, and the `matcher` config export all had to change
  together (`npx @next/codemod@canary middleware-to-proxy .` did this correctly, though its
  `--dry` flag turned out not to actually gate the file rename/delete — it renamed for real even
  in "dry" mode, worth knowing before trusting `--dry` output from this codemod again). One
  behavioral simplification came with the rename: a **Proxy file always runs on the Node.js
  runtime** — the `export const runtime = "nodejs"` segment config our file needed under the old
  `middleware.ts` convention (to use `node:crypto` for HMAC session verification) is now not just
  unnecessary but actively rejected by Next if present. If a future Next major renames this again,
  grep for `middleware.ts`/`proxy.ts` across the repo (comments reference it by name in a few
  places) before assuming the rename script caught everything.
- **Two different clocks are used deliberately, and mixing them up is a real bug class, not a
  style choice.** Fields the user reads as a clock face (`checkIn`, `checkOut`) are always
  captured client-side with `getNaiveLocalNow()`/`combineDateAndTime()` and encode local
  wall-clock time into a Date's *UTC* getters (see `src/lib/domain/date.ts`). Fields that are
  never displayed, only diffed (`breakStartedAt`, task `timerStartedAt`), use the server's real
  `new Date()`/`Date.now()` — simpler and correct, since only the elapsed difference matters.
  **Never subtract one category from the other.** `endWork` originally did exactly that
  (computed break-elapsed as `checkOutAt.getTime() - breakStartedAt.getTime()`), which is only
  correct by coincidence when checkOutAt happens to be "right now" — an integration test using
  a far-future WorkDay date exposed it as a multi-decade elapsed value that overflowed
  Postgres's integer column. Fixed to use `Date.now()` for that calculation instead of
  `checkOutAt`. If a new feature ever needs to diff a "clock face" field against a "real time"
  field, that's a sign the design needs rethinking, not a quick subtraction.
- **Forms using `useActionState` must use controlled inputs (`value`/`onChange`), never
  `defaultValue`.** Found via manual browser verification in Phase 4, across three different
  forms (task add/edit dialog, WorkDay notes/holiday, manual time-edit): React 19 resets a
  `<form action={...}>`'s uncontrolled fields after *any* action call that resolves without
  throwing — including our own validation-error returns, since those still resolve successfully
  as far as React's form machinery is concerned. With `defaultValue`, a validation error
  silently wiped everything the user had just typed. Applies to every future form built this
  way, not just these three.
- **Client-only derived state uses `useSyncExternalStore` or the "adjust state during render"
  pattern — never `useEffect` + `setState`.** The new `react-hooks` lint rule
  (`react-hooks/set-state-in-effect`, part of `eslint-plugin-react-hooks@7.1.1`) catches this at
  lint time now, so it's enforced, not just a style preference. `src/hooks/use-is-today.ts`
  uses `useSyncExternalStore` for "is this the browser's local today" (server/client snapshot
  mismatch handled in one pass, no extra render). `TimeTrackingCard`'s manual-edit inputs use
  React's documented pattern for "re-sync state when a prop actually changes" — compare against
  a snapshot state variable and call `setState` directly in the render body when it differs, not
  inside an effect.
- **Dashboard and Calendar compute "today" server-side** (`getServerToday()` in each page,
  UTC-truncated `new Date()`), unlike `/worklog` and the time-tracking quick-actions, which
  deliberately use the browser's local date/time. This is a conscious scope decision, not an
  oversight: those two pages are read-only overviews — being off by a few hours right at a
  timezone's midnight boundary means a brief, self-correcting staleness in a summary view, not
  a wrong mutation. If either page ever grows a write path (e.g. a "mark today" quick action),
  that path must use `getLocalISODate`/`getNaiveLocalNow` like `/worklog` does, not this
  server-side helper.
- **Calendar day coloring reuses `WorkDayStatus` directly** — the four states the spec asked
  for (no record / work recorded / holiday / incomplete) map exactly onto
  NOT_STARTED/COMPLETED/HOLIDAY/IN_PROGRESS, so there's no separate "calendar state" concept to
  keep in sync. A `WorkDay` row with status `NOT_STARTED` (e.g. auto-created by visiting a
  date's `/worklog/[date]` without touching it) renders identically to "no record" — same
  border style — since there's nothing meaningful to show either way.
- **Dashboard's "Recent Work Days" filters out empty `NOT_STARTED` rows with no tasks**
  (`getRecentWorkDays` in `src/lib/data/workday.ts`). Necessary because `findOrCreateWorkDayByDate`
  auto-creates a row on any `/worklog/[date]` visit, including ones reached by clicking around
  the Calendar out of curiosity — those shouldn't clutter a "recent work" list. A row counts as
  real activity if its status isn't NOT_STARTED, or it has at least one task.
- **Dashboard's "Completed" task stat counts `timerStatus === "COMPLETED"` specifically**, not
  every logged task — a task can have a manually-entered duration and never be run through the
  timer, which is fine (§11: timer is optional), but means it stays outside this specific count.
  "Tasks this month" is the total count regardless of timer status.
- **Statistics scope: task-related stats ("Tasks this month", "Completed this month", "Avg.
  task duration") are month-scoped**, matching the three duration stats next to them
  ("This month's hours" etc.) — the spec listed them together without specifying scope
  explicitly, and month-scoped is what stays useful without growing unbounded over the life of
  the app.
- **SkillMap search/category filter is client-side, not server-side.** `listSkills()` takes no
  filter arguments — it fetches everything once (a personal SkillMap is dozens of entries, not
  thousands) and `src/components/skill/skill-map.tsx` filters in the browser. Simpler and more
  responsive than round-tripping on every keystroke; revisit only if the skill count ever grows
  enough to matter, which isn't expected for this app.
- **Task↔Skill association uses full-replace semantics**, not incremental add/remove:
  `setTaskSkills(taskId, skillIds)` deletes every existing `TaskSkill` row for that task and
  recreates exactly the given set, in one transaction. The Task form submits the complete
  desired skill-id list on every save (a checkbox list), so this matches how the UI actually
  produces data — no diffing needed on either side.
- **Every mutation keyed by an existing record's id must tolerate that record already being
  gone (P2025), not throw.** Found in Phase 6 via Playwright e2e runs: editing a Task/Skill and
  then deleting it shortly after — even sequentially, well outside any obvious click race —
  occasionally left a *delayed* duplicate update landing after the delete had already
  committed, crashing with an unhandled `PrismaClientKnownRequestError` (P2025). Reproduced
  for Task first, fixed it there, then the **identical** pattern immediately reproduced for
  Skill in the next run — strong evidence this is systemic (something about how Next dev mode
  can duplicate/delay a form-action's underlying mutation), not a one-off. The exact trigger
  was never pinned down (never reproduced running a single test file in isolation, only as
  part of a longer suite run, and it disappeared once both were fixed) — the fix doesn't depend
  on knowing why: `tolerateAlreadyDeleted()` in `src/lib/data/shared.ts` catches P2025 and
  returns `null` instead of throwing; `updateTask`/`deleteTask`/`duplicateTask`/the four task
  timer functions and `updateSkill`/`updateSkillProficiency`/`deleteSkill` all use it. Callers
  (Server Actions, tests) must handle a `null` return — this is a real, if narrow, correctness
  requirement, not defensive-programming theater: a genuine double-click under network lag
  hits this same path in production. **Any new mutation added later that targets one existing
  record by id should use this helper too**, the same way `findOrCreateWorkDayByDate`'s P2002
  handling became the template for "create" races.
- **Known upstream issue, not ours to fix:** `npm audit` reports a high-severity
  stack-exhaustion advisory in `deepmerge-ts`, pulled in transitively by Prisma's own
  `@prisma/config` package (dev-tool-only, not in the runtime bundle). `npm audit fix --force`
  would downgrade to Prisma 6, which we don't want. Revisit when Prisma patches it upstream.
- **Second known upstream issue, also not ours to fix:** `npm audit` also reports a moderate
  `uuid` advisory (buffer-bounds-check issue in v3/v5/v6 generation), pulled in transitively by
  `exceljs` for internal xlsx-part IDs — not used for anything security-sensitive like session
  tokens. `npm audit fix --force` would downgrade to `exceljs@3.4.0`, losing features we use.
  Revisit when ExcelJS updates its own dependency.
- **Deployment target: Vercel.** `prisma generate` runs via a `postinstall` script (Vercel's
  build doesn't run it automatically). Production schema changes are applied with
  `prisma migrate deploy` — never `prisma db push` — run as part of the build step so a
  failed migration fails the deploy instead of shipping a broken schema.
- **Local dev also points at the cloud Neon Postgres instance** (no local Postgres/Docker
  available on this machine — decided in Phase 0). `.env` holds
  `DATABASE_URL`/`DATABASE_URL_UNPOOLED` and is gitignored; `.env.example` holds placeholders
  only.
- **Single-user, no multi-tenancy in the schema.** No `userId` foreign keys on domain tables.
  Auth (Phase 10) gates the whole app, not per-user rows — no `User`/`Session` table exists or is
  planned.
- **Auth (Phase 10): a single shared password, not an account system.** The spec (§30/§38) never
  commits to building auth at all — it's explicitly optional ("if authentication is added...").
  Confirmed with the user before implementing (this app deploys to a public Vercel URL, so *some*
  gate matters): one shared password, bcrypt-hashed (`bcryptjs`, cost 12) and stored as
  `AUTH_PASSWORD_HASH`, no user table, no OAuth/next-auth/iron-session dependency — proportionate
  to a single-user tool with exactly one credential and no multi-provider need (same "no
  state-management library added by default" reasoning as §2). Sessions are a custom
  stateless-signed-cookie scheme (`src/lib/auth/session.ts`): `"<base64url payload>.<HMAC-SHA256
  signature>"`, verified with `node:crypto`'s `timingSafeEqual`, `SESSION_SECRET`-keyed, 30-day
  expiry, no server-side session store to invalidate (rotating `SESSION_SECRET` is the only way
  to force-invalidate every session at once). `src/proxy.ts` gates every route except `/login`
  and `/api/health`; unauthenticated page requests redirect to `/login?from=<path>`, unauthenticated
  `/api/*` requests get a 401 JSON body instead (a redirect would silently corrupt a binary/JSON
  response body). Login/logout are Server Actions (`src/lib/actions/auth-actions.ts`), not Route
  Handlers — no file I/O involved, matches the established split (§3/§8).
- **`AUTH_PASSWORD_HASH` is stored base64-encoded, never as the raw `"$2b$12$..."` bcrypt hash
  string — a real bug found and fixed in Phase 10, not a stylistic choice.** Next.js's own `.env`
  loader (`@next/env`, built on `dotenv-expand`) treats `$` as shell-style variable-expansion
  syntax. A raw bcrypt hash's `$2b$12$...` segments got silently parsed as expansion tokens and
  stripped to near-nothing (`$2b$12$y/ZOM...` became `/ZOM...` — the login form always failed with
  "Incorrect password," confirmed correct behind the scenes via a standalone script using plain
  `dotenv/config`, only broken through Next's actual env loader). Neither `$$`-escaping nor
  single-quoting reliably prevented it in the installed `@next/env`/`dotenv-expand` version —
  tested both directly against `@next/env`'s `loadEnvConfig`, both still corrupted the value.
  Base64 has no `$` in its alphabet, sidestepping the whole issue regardless of dotenv-expand's
  exact escaping behavior. `scripts/hash-password.ts` outputs the value pre-encoded;
  `src/lib/auth/password.ts` always base64-decodes before `bcrypt.compare`. **This means Vercel
  env vars need the same base64-encoded value too, not the raw hash** — Vercel's dashboard
  doesn't run values through dotenv-expand, so a raw hash pasted there wouldn't get mangled the
  same way, but the app would still try to base64-decode it and fail closed (safe, but broken
  until fixed) — always use the script's output verbatim, on every environment. See
  DEPLOYMENT.md §6 step 5 for the full explanation aimed at the user.
- **No per-row timezone handling.** All check-in/out/break/task timestamps are stored as
  naive local wall-clock time tied to `WorkDay.date`. This is a single-user, single-timezone
  tool; documented here so nobody "fixes" it into UTC conversion later.
- **`Holiday` (reference calendar) vs `WorkDay.isHoliday` (actual recorded status) are
  different things.** `Holiday` is a small reference table of known dates (e.g. national/
  company holidays) used to auto-suggest status when a date is selected. `WorkDay.isHoliday`
  is the actual, editable, submitted status for that day. This resolves the spec's apparent
  overlap between "configured holiday" (§8) and "mark a day as holiday" (§13).
- **Excel holiday-row layout is an assumption, still not visually confirmed.** No screenshot
  has ever been provided — only the text description. Implemented in Phase 7 exactly as
  originally planned: a single row per holiday with Date/Day filled in, Check In/Out/Break
  blank, and `"HOLIDAY"` (plus `(reason)` if one was set) in the Task List column — see
  `src/lib/excel/export.ts`. **Still needs a real visual review against the user's actual
  submission file** before being considered fully done; the browser-automation tool wasn't
  available during Phase 7's session, so this was verified structurally (round-trip read-back
  tests) but not by eye against a reference document.
- **Date/time display formats inferred from spec examples**, not a screenshot — implemented as
  planned: `MM/DD/YYYY` (`formatDateUS` in `src/lib/domain/date.ts`, e.g. `03/08/2026`), Check
  In/Out as `h:mm AM/PM` (e.g. `10:10 AM`), durations as `H:MM:SS` with no leading zero on
  hours (e.g. `4:00:00`, `0:30:00`). All written as plain formatted strings, not native Excel
  date/time cell types — deliberately, to keep using our established UTC-getter-based
  naive-local formatting instead of trusting ExcelJS's own Date-to-serial-number conversion,
  which could reintroduce a timezone bug of exactly the kind already fixed three times this
  project (see the "two different clocks" entry above). **Still needs confirmation against the
  real submission format**, same caveat as the holiday layout above.
- **Server Actions for mutations, Route Handlers only for file I/O** (`/api/export`,
  `/api/import`) since those need binary/streaming responses, not HTML.
- **Repository layer (`src/lib/data/*`) sits between Server Actions/Route Handlers and
  Prisma.** Business logic (duration math, validation, category derivation) lives in
  `src/lib/domain/*` as pure functions so it's unit-testable without a database.
- **Integration tests that touch the real Neon DB must run in Vitest's `node` environment,
  not `jsdom`.** Discovered in Phase 2: `@prisma/adapter-neon` uses WebSockets
  (`@neondatabase/serverless`), and jsdom installs its own `WebSocket`/`Event` globals that
  collide with it — cross-realm `instanceof Event` checks fail inside `undici`, and queries
  just hang until the test times out (looked like the DB was slow; it wasn't). Fix: every file
  under `src/test/integration/` starts with `// @vitest-environment node` as its first line,
  overriding the project-wide `jsdom` default set in `vitest.config.ts` (which stays `jsdom`
  for component tests). If a new integration test file times out mysteriously, check this
  first before assuming a real DB/network problem.
- **DB tables use snake_case names via Prisma `@@map`** (e.g. `work_days`, `skill_history`);
  Prisma models themselves stay PascalCase/camelCase as usual. Applies to every model in
  `schema.prisma`.
- **Database-level `CHECK` constraints (Phase 10, spec's "database constraints" review item) are
  hand-written raw SQL in a migration, not expressed in `schema.prisma`.** Prisma 7 has no native
  `@check`/`@@check` attribute, so `prisma/migrations/20260825115715_add_check_constraints/
  migration.sql` was created via `prisma migrate dev --create-only` (empty scaffold) then
  hand-edited: `work_days.breakSeconds >= 0`, `work_days.checkOut > checkIn` (nullable-safe),
  `tasks.durationSeconds >= 0`, `skills.proficiencyPercentage BETWEEN 0 AND 100`,
  `skill_history.fromPercentage`/`toPercentage BETWEEN 0 AND 100`. These mirror invariants
  already enforced at the Zod layer (§5) — genuine defense-in-depth (a bug in a data-layer
  function that skips validation still can't write impossible data), verified in
  `src/test/integration/db-constraints.test.ts` by calling `prisma.*.create` directly (bypassing
  Zod entirely) and asserting Postgres itself rejects each case. If `schema.prisma` ever changes
  one of these columns, remember to check whether the hand-written constraint still matches —
  nothing keeps them in sync automatically.
- **`src/lib/db.ts` loads `.env` itself** (`import "dotenv/config"` at the top), not just
  relying on Next.js's automatic env loading. Found in Phase 3: Playwright runs spec files
  directly through Node, not through Next, so `DATABASE_URL` was undefined the moment an e2e
  test imported anything that pulled in `db.ts`. dotenv never overwrites already-set vars, so
  this is harmless when Next (or tsx scripts that already `import "dotenv/config"`) load it
  first. If a new script/test importing `db.ts` mysteriously can't connect, check this first.
- **`package.json` has `"type": "module"`.** Needed because Playwright's default loader can't
  handle `import.meta` inside the generated Prisma client without the package being real ESM
  (this surfaced as a hard `SyntaxError`, not just Vitest's earlier cosmetic warning). Verified
  no `require()` calls or bare `.js` config files existed anywhere in the repo before flipping
  it. `vitest.config.ts` uses `import.meta.dirname`, not `__dirname` (doesn't exist in ESM).
- **Delete confirmations use shadcn `AlertDialog`, never `window.confirm()`.** Tried
  `confirm()` first for the task-delete flow in Phase 3 — it's a native blocking dialog that
  both weakens accessibility (§37 wants "proper dialog behavior") and would freeze this
  session's own browser-automation tooling mid-verification. Applies to any future
  destructive-action confirmation in the app, not just tasks.
- **`findOrCreateWorkDayByDate` (the "open today's page" entry point) needed real hardening,
  not just an `upsert`.** Found via manual browser verification in Phase 3 — a plain
  get-then-create raced 100% of the time under Next's concurrent document+RSC-flight requests
  for a brand-new date, crashing on the `date` unique constraint. Switching to `prisma.upsert`
  alone still surfaced the same `P2002` error under stress-testing (~1 in 16 runs against 3-way
  concurrent calls) rather than resolving silently — so the function now also catches `P2002`
  and re-fetches, plus a bounded 3-attempt retry for rarer transient pooled-connection errors
  (observed as an occasional slow failure, ~26s vs. the normal ~8s, consistent with a network
  blip rather than a logic bug). See `src/lib/data/workday.ts`. If any other "find-or-create by
  unique key" function gets added later, copy this pattern rather than a plain get-then-create.

## 4. Data Model

```
WorkDay (1) ──< Task (many) >── TaskSkill >── Skill (many)
                                                   │
                                              SkillHistory (many)

Holiday  — standalone reference table, not FK-linked to WorkDay
```

### WorkDay
`id, date (unique, date-only), checkIn (nullable), checkOut (nullable), breakSeconds (int,
default 0), breakStartedAt (nullable — set while "on break"), status (enum:
NOT_STARTED | IN_PROGRESS | COMPLETED | HOLIDAY), isHoliday (bool), holidayReason (nullable),
notes (nullable), createdAt, updatedAt`

### Task
`id, workDayId (FK, cascade delete), taskId (string, e.g. "T-1039", validated format,
not globally unique — same Task ID can recur across days), description, durationSeconds (int),
link (nullable, validated URL), order (int, for manual reordering), timerStatus (enum:
NONE | RUNNING | PAUSED | COMPLETED), timerStartedAt (nullable), createdAt, updatedAt`

Task duration accumulates: `durationSeconds` holds all *completed* elapsed time; while
`timerStatus = RUNNING`, current elapsed = `durationSeconds + (now - timerStartedAt)`. Pausing
folds that delta into `durationSeconds` and clears `timerStartedAt`.

### Skill
`id, name (unique), category (enum: LESS_THAN_30 | BETWEEN_30_70 | MORE_THAN_70, derived —
never set directly), proficiencyPercentage (int, 0–100), notes (nullable), createdAt, updatedAt`

Category boundaries (documented per spec §21): `0–29 → LESS_THAN_30`,
`30–70 → BETWEEN_30_70`, `71–100 → MORE_THAN_70`. Computed server-side on every write, not
trusted from the client — see `src/lib/domain/skill.ts` (`deriveSkillCategory`).

Seeded (Phase 2, `prisma/seed.ts`) with the 25 skills from the user's SkillMap screenshot,
grouped into the three bands. The spec only gave exact percentages for 3 of them (Power BI
20%, Java 55%, React.js 85%) — the rest were assigned a reasonable value within their stated
band by Claude, not extracted from the source. All are editable via the Skills UI (Phase 6);
these are just seed defaults, never hardcoded UI text.

### SkillHistory
`id, skillId (FK), fromPercentage, toPercentage, changedAt` — one row appended whenever
`proficiencyPercentage` changes.

### TaskSkill (join table)
`taskId, skillId` — composite PK. Optional association; a task may have zero skills.

### Holiday (reference calendar, not per-user data)
`id, date (unique, date-only), name, createdAt, updatedAt`

## 5. Business Rules

- `Day` is always derived from `date` — never stored as free text, never manually entered.
- Net Work Duration = `checkOut - checkIn - breakSeconds` (when both check-in and check-out exist).
- Total Task Duration = sum of all `Task.durationSeconds` for that `WorkDay`.
- Warn (do not block or silently modify) when Total Task Duration exceeds Net Work Duration by
  more than a fixed tolerance. **Tolerance = 60 seconds**, defined as a named constant in
  `src/lib/domain/workday.ts` (`DURATION_TOLERANCE_SECONDS`), not a magic number.
  Discrepancy is a warning; the app never rewrites task durations to "fix" it.
- `checkOut` must be after `checkIn` on the same day. Overnight shifts (checkout past
  midnight) are **out of scope for v1** — documented limitation, not silently mishandled.
- A `WorkDay` marked `isHoliday = true` should not require any `Task` rows.
- Task ID format: validated but intentionally permissive — pattern `^[A-Za-z]+-\d+$` (e.g.
  `T-1039`), configurable via a single regex constant rather than hardcoded inline.
- Skill `proficiencyPercentage` clamped to `[0, 100]` at the validation layer (Zod) before it
  ever reaches the database.

## 6. Excel Export Requirements

Exact header row, in this order, always:
`Date | Day | Check In | Check Out | Break | TaskID | Task List | Duration of Task | Links`

- One work day → one visual block. If it has N tasks, Date/Day/Check In/Check Out/Break are
  vertically merged across N rows; TaskID/Task List/Duration of Task/Links vary per row.
- Holidays render as a single row (see open item above — layout to be confirmed in Phase 7).
- Links are real Excel hyperlinks (`cell.value = { text, hyperlink }`), not plain text.
- Header row bold + filled + frozen. All data cells bordered. Task List column wraps text.
  Sensible column widths, not auto-fit-and-forget.
- Every export is round-trip tested: write with ExcelJS, then **read the file back** with
  ExcelJS and assert on headers/rows/merges/hyperlinks. "The browser downloaded a file" is
  never treated as a passing test.

## 7. Folder Structure (Next.js app at repo root)

```
task-log/
├── CLAUDE.md
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                  # seeds SkillMap data from spec §20
├── src/
│   ├── app/
│   │   ├── login/page.tsx        # Phase 10 — the only page reachable without a session
│   │   ├── dashboard/page.tsx
│   │   ├── worklog/[date]/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── skills/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── export/page.tsx
│   │   ├── import/page.tsx
│   │   ├── settings/page.tsx     # holiday calendar config
│   │   └── api/
│   │       ├── export/route.ts
│   │       ├── import/route.ts
│   │       └── health/route.ts
│   ├── components/
│   │   ├── ui/                   # shadcn primitives
│   │   ├── auth/ workday/ task/ skill/ calendar/ dashboard/ layout/
│   ├── lib/
│   │   ├── db.ts                 # Prisma client singleton
│   │   ├── data/                 # repository layer (Prisma calls only)
│   │   ├── domain/                # pure business logic — unit tested, no I/O
│   │   ├── actions/               # Server Actions
│   │   ├── auth/                  # Phase 10 — session.ts, password.ts (no user table)
│   │   ├── excel/                 # export.ts, import.ts (ExcelJS)
│   │   └── validation/            # Zod schemas
│   ├── proxy.ts                  # Phase 10 — whole-app auth gate (Next 16's middleware.ts
│   │                              # convention was renamed to proxy.ts; see CLAUDE.md §3)
│   └── test/{unit,integration,setup.ts}
├── e2e/                          # Playwright specs
├── scripts/
│   ├── verify-db.ts
│   └── hash-password.ts          # Phase 10 — generates AUTH_PASSWORD_HASH/SESSION_SECRET
├── .env.example
└── (config: package.json, tsconfig.json, tailwind config, vitest.config.ts, playwright.config.ts)
```

## 8. Coding Conventions

- No business logic in Server Actions or Route Handlers beyond parsing input (Zod) and calling
  `lib/domain` + `lib/data`. Keeps logic testable without spinning up Next.js.
- Durations always stored/passed as integer seconds internally; formatted to `H:MM:SS` only at
  the UI/export boundary (`lib/domain/duration.ts`).
- No `any`; Prisma-generated types + Zod-inferred types flow through instead of hand-duplicated
  interfaces.
- Comments only for non-obvious *why* (e.g. tolerance constants, timezone-naive decision) —
  not restating what code does.

## 9. Testing Commands (finalized in Phase 1)

- `npm run test` — Vitest unit + integration
- `npm run test:e2e` — Playwright
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — production build
- `npm run db:generate` (`prisma generate`) — also runs automatically via `postinstall`
- `npm run db:migrate` (`prisma migrate dev`, local/dev schema changes) — uses
  `DATABASE_URL_UNPOOLED` via `prisma.config.ts`
- `npm run db:deploy` (`prisma migrate deploy`, production — applies existing migrations,
  never generates new ones) — uses `DATABASE_URL_UNPOOLED`, run in the Vercel build step
- `npm run db:verify` (`tsx scripts/verify-db.ts`) — smoke-tests the pooled runtime connection
- `npm run db:seed` (`prisma db seed`) — added in Phase 2 once `prisma/seed.ts` exists

## 10. Phase Progress

| Phase | Status |
|---|---|
| 0 — Discovery & Architecture | ✅ Done (this document) |
| 1 — Project Foundation | ✅ Done — Next.js 16 (App Router, Turbopack) + Tailwind v4 + shadcn/ui base + Prisma 7/Neon + ESLint 9 + Vitest + Playwright, all verified |
| 2 — Database & Core Domain | ✅ Done — schema (`WorkDay`, `Task`, `Skill`, `SkillHistory`, `TaskSkill`, `Holiday`), first real migration applied, SkillMap seeded (25 skills), thin repository layer, 23 tests passing |
| 3 — Work Log CRUD | ✅ Done — WorkDay/Task CRUD, day derivation, duration & Task-ID validation, 60 Vitest tests + 3 Playwright e2e tests, all passing |
| 4 — Time Tracking | ✅ Done — Start/End Work, break tracking, task timer, net work duration, discrepancy warnings; 100 Vitest tests + 4 Playwright e2e tests, all passing |
| 5 — Dashboard & Calendar | ✅ Done — Today's Work, Statistics, Recent Work Days, month calendar with status color-coding; 119 Vitest tests + 8 Playwright e2e tests, all passing |
| 6 — SkillMap | ✅ Done — full CRUD, search/filter, progress bars, proficiency history, task-to-skill association; 141 Vitest tests + 11 Playwright e2e tests, all passing |
| 7 — Excel Export | ✅ Implemented (177 Vitest + 12 Playwright tests passing), ⚠️ holiday-row layout & date/time formats still need visual confirmation against the real submission format — see §3 |
| 8 — Reports | ✅ Done — Work/Task/Monthly Summary + Skill Usage, date-range filtering; 188 Vitest tests + 14 Playwright e2e tests, all passing |
| 9 — Excel Import | ✅ Done — upload, header/row validation, preview, confirm-before-save, duplicate detection; 206 Vitest tests + 16 Playwright e2e tests, all passing |
| 10 — Security & Hardening | ✅ Done — single-password auth gate, DB CHECK constraints, security/error-handling/validation review, a11y/responsive spot-checks; 223 Vitest tests + 21 Playwright e2e tests, all passing |
| 11 — Final QA | ✅ Done — full manual QA pass across all 7 checklist categories, 2 real bugs found and fixed, delete-WorkDay feature added, unused dependency removed; 224 Vitest tests + 22 Playwright e2e tests, all passing |

## 11. Instructions for Future Claude Sessions

- Follow the phase-by-phase process: implement one phase, test it, summarize, **stop**. Do not
  jump ahead.
- Database connectivity is done: Neon Postgres via Vercel integration, `.env` has
  `DATABASE_URL`/`DATABASE_URL_UNPOOLED`, `.gitignore` confirmed working
  (`git check-ignore -v .env`), connection verified both ways (`npm run db:verify` for the
  pooled runtime path, `npx prisma migrate dev` for the direct CLI path). See `DEPLOYMENT.md`
  for the full provisioning + deploy process, and §3 above for why the config looks the way it
  does under Prisma 7.
- Never use `prisma db push` for schema changes outside of quick local experimentation —
  every schema change ships as a real migration via `prisma migrate dev`.
- Phase 1 is complete: Next.js 16 (App Router, Turbopack) scaffold, Tailwind v4, shadcn/ui
  base (`cn` util, `components.json`, one `Button` primitive), header nav across all planned
  routes (each a placeholder pointing at the phase that builds it for real), ESLint 9 flat
  config, Vitest + Testing Library, Playwright. `npm run dev|build|lint|typecheck|test|test:e2e`
  all pass.
- Phase 2 is complete: full Prisma schema applied via a real migration, `src/lib/domain/skill.ts`
  (category derivation), `src/lib/data/{workday,task,skill,holiday}.ts` (thin repository layer),
  `prisma/seed.ts` (idempotent SkillMap seed). 23 tests passing (unit + integration against the
  real Neon dev DB, cleaned up after themselves — verified no residue left behind). See the
  jsdom/Neon-WebSocket gotcha above before writing more integration tests.
- Phase 3 is complete: `/worklog` (redirects to today via the *browser's* local date, not
  server UTC) and `/worklog/[date]` (day header with notes/holiday toggle, task table with
  add/edit/duplicate/delete/reorder). Domain additions: `src/lib/domain/date.ts`
  (`getDayName`, `isWeekend`, `formatDisplayDate`, `getLocalISODate`),
  `src/lib/domain/duration.ts` (H:MM:SS ⇄ seconds), `src/lib/domain/task.ts` (Task ID regex).
  Zod schemas in `src/lib/validation/`, Server Actions in `src/lib/actions/`. Task Link URLs
  are restricted to http(s) at the validation layer, not just checked for well-formedness.
  Four real bugs were found and fixed via manual browser + stress testing before calling this
  phase done (see §3 above) — manual verification is not optional for UI phases, it's what
  caught three of the four.
- Phase 4 is complete: Start/End Work (`src/lib/data/workday.ts` `startWork`/`endWork`), break
  tracking (manual + start/end, folded into `endWork` automatically), task timer
  (Start/Pause/Resume/Complete, `src/lib/data/task.ts`), Net Work Duration + Total Task
  Duration + discrepancy warning (`src/lib/domain/workday.ts`), live-ticking UI
  (`src/components/workday/live-elapsed.tsx`). Three more real bugs found via manual browser
  verification and stress testing (see §3): a naive-local-vs-real-time epoch mismatch in
  `endWork`, a form-reset-on-validation-error bug across three forms, and a
  `react-hooks/set-state-in-effect` lint violation requiring `useSyncExternalStore`/render-time
  state adjustment instead of the effect+setState pattern used in Phase 3.
- Phase 5 is complete: `/dashboard` (Today's Work, Statistics, Recent Work Days) and
  `/calendar` → `/calendar/[month]` (month grid, status color-coded, prev/next navigation,
  click-through to `/worklog/[date]`). New domain helpers: `getWeekRange`/`getMonthRange`/
  `sumNetWorkSeconds` (`src/lib/domain/workday.ts`), `getLocalMonth`/`parseMonthOnly`/
  `formatMonthLabel`/`addMonths` (`src/lib/domain/date.ts`). `WORK_DAY_STATUS_LABELS` is now
  shared from `src/lib/domain/workday.ts` rather than duplicated per component. Verified
  end-to-end with seeded demo data in a real browser (dashboard stat math checked by hand
  against the seeded values) before cleaning it up. No new bugs found this phase — the pattern
  discipline built up in Phases 3–4 (client-captured local time, controlled forms, render-time
  state sync) held up without needing new fixes.
- Phase 6 is complete: SkillMap CRUD (`src/components/skill/*`), progress bars, search +
  category filter, proficiency history display, task-to-skill association (checkbox list in
  the Task form, skill badges on task rows). Data layer extended: `updateSkill`/`deleteSkill`/
  `getSkillById` in `src/lib/data/skill.ts`, `setTaskSkills` in `src/lib/data/task.ts`. A real
  and fairly serious bug was found via Playwright (see §3's `tolerateAlreadyDeleted` entry) —
  an unhandled P2025 crash on edit-then-delete races, reproduced identically for both Task and
  Skill, fixed with a shared helper now used by every id-keyed mutation in both modules, with
  regression tests covering it directly (not just working around it).
- Phase 7 is complete: Excel export via ExcelJS (`src/lib/excel/export.ts`
  `buildWorkLogWorkbook`), exact spec header row/order, per-work-day vertical cell merging,
  borders/fills/frozen header/wrapped Task List column, real hyperlinks, holiday rows, and
  three export entry points (day/month/custom range) validated by a Zod discriminated union
  (`src/lib/validation/export.ts`) behind a Route Handler (`src/app/api/export/route.ts`, not a
  Server Action, per the established file-I/O rule). New domain helper: `formatDateUS` in
  `src/lib/domain/date.ts`; new `src/lib/domain/export.ts` for filename generation. UI:
  `/export` page with quick "Export Today"/"Export This Month" links
  (`src/hooks/use-local-date.ts`, `useSyncExternalStore`-based, avoiding the Phase 4
  set-state-in-effect lint trap for client-computed dates) and a plain native GET form for
  custom ranges — zero client JS needed for the download itself. 177 Vitest tests (unit +
  integration against the real Neon DB, including reading exported buffers back with ExcelJS)
  and 12 Playwright tests (including a real HTTP download + file-read-back e2e test) all
  passing; typecheck/lint/build clean. Also fixed a pre-existing (Phase 6) Playwright flake
  unrelated to this phase — raised the global `expect` timeout to 10s in
  `playwright.config.ts` after diagnosing it as parallel-worker resource contention, not a
  logic bug. **Not fully done, by design:** the holiday-row layout and date/time formats are
  still unconfirmed assumptions (§3) — no screenshot of the real submission format has ever
  been provided, and the browser-automation tool was unavailable this session so this phase
  could only be verified structurally (round-trip read-back tests), not by eye. Re-check both
  against the user's actual submission file as soon as it's available, and treat that as
  outstanding before Phase 7 is considered fully closed rather than just "implemented."
- Phase 8 is complete: `/reports` page implementing all four report groupings from spec §31 —
  Work Summary (total working days, total hours, average daily hours, total task duration),
  Task Summary (number of tasks, tasks by date, tasks by Task ID), Skill Usage (tasks by skill,
  time by skill), and Monthly Summary (per-month totals) — plus a shared date-range filter.
  New pure domain module `src/lib/domain/reports.ts` (`buildWorkSummary`, `groupTasksByDate`,
  `groupTasksByTaskId`, `groupTasksBySkill`, `buildMonthlySummary`) operating on plain
  WorkDay/Task shapes so it's unit-testable without a database, per the established
  domain/data-layer split. New `src/lib/data/reports.ts` (`getTasksInRange`) queries `Task`
  directly (not through `WorkDay.tasks`) since Reports needs each task's WorkDay date and
  associated skills in one shape that `listWorkDays()`'s existing include doesn't provide. "Total
  working days" is defined as WorkDay rows with `checkIn` set (in progress or completed both
  count; holidays and untouched NOT_STARTED rows don't) — see the doc comment on
  `buildWorkSummary`. Skill time attribution: a task tagged with multiple skills contributes its
  *full* duration to each one (not divided), since each skill was genuinely exercised for the
  task's whole duration. The `/reports` page is a Server Component reading `searchParams`
  (`from`/`to`) with a plain native GET filter form (same zero-client-JS pattern as
  `ExportRangeForm`); an invalid/missing/inverted range falls back to the current month rather
  than 404ing, since this is an optional filter on a read-only page, not a route param
  identifying one resource (contrast `/calendar/[month]`, which does 404 on a bad month
  segment). 11 new Vitest tests (pure-function unit tests for every grouping/summary function,
  plus one real-DB integration test) and 2 new Playwright tests — 188 Vitest + 14 Playwright
  total, all passing; typecheck/lint/build clean (`next build` run directly, see below). **A
  real bug was found and fixed via Playwright**, not a product bug but a test-authoring one:
  the two `reports.spec.ts` tests originally shared one `TEST_DATE` constant with a top-level
  `test.afterEach` cleanup; since `playwright.config.ts` sets `fullyParallel: true`, both tests
  run concurrently in separate workers, and the non-seeding test's `afterEach` intermittently
  deleted the seeding test's WorkDay/Task mid-request (cascade-deleting the Task), surfacing as
  `TypeError: Cannot read properties of null (reading 'date')` in `groupTasksByDate` — fixed by
  giving the seeding test its own dedicated date and scoping its cleanup to a local `try/finally`
  instead of a shared file-level `afterEach`. **General lesson for future e2e specs in this
  project:** never share a test-data date (or any cleanup-triggering constant) across multiple
  tests in the same file unless every test that touches it participates in seeding it — under
  `fullyParallel: true`, one test's teardown can delete another's still-in-use fixture data.
  Also hit, and worked around rather than fixed (out of scope — pure environment networking, zero
  schema changes this phase): `npm run build`'s `prisma migrate deploy` step couldn't reach the
  direct/unpooled Neon connection (raw TCP `:5432`) in this sandbox, while the pooled connection
  (WebSocket over `:443`, used by `npm run test`'s integration suite and `db:verify`) worked
  fine every time — verified the actual Next.js build compiles cleanly by running `npx next
  build` directly. If a future session hits the same `P1001` on `migrate deploy` specifically
  (not on `db:verify` or the test suite), suspect this same outbound-port restriction before
  assuming a real connectivity or credentials problem.
- Phase 9 is complete: Excel Import per spec §30/§41 — upload a previously-exported `.xlsx`,
  validate it, preview the parsed result, and only write to the database after explicit
  confirmation, never overwriting an existing day. New parsing module
  `src/lib/excel/import.ts` (`parseWorkLogWorkbook`) reads the file with ExcelJS, validates the
  header row against the same `EXCEL_HEADERS` constant Export writes, then walks rows 2..N
  grouping contiguous same-date rows into one `ImportGroup` per WorkDay (mirroring how
  `buildWorkLogWorkbook` always writes one contiguous block per day — grouping assumes rows for
  a day are contiguous, which holds for our own export and any reasonable hand-edit). Two new
  inverse-of-export date/time parsers in `src/lib/domain/date.ts`: `parseDateUS` (inverse of
  `formatDateUS`) and `parseClockTimeToHHMM` (inverse of `formatClockTime`, returns "HH:MM" for
  `combineDateAndTime`) — both reject malformed and calendar-invalid input rather than silently
  coercing it (spec §33/§34). Per-row problems (bad Task ID, Check Out before Check In, a link
  not starting with http(s), an unparseable date) are collected as `errors`/`rowErrors` on the
  preview rather than thrown, so one bad row doesn't block importing the rest of the file (spec
  §30: "report invalid rows"). Duplicate detection happens one layer up, in the Route Handler
  (`src/app/api/import/route.ts`, POST) — the only file-I/O step, per the established
  Route-Handler-for-file-I/O / Server-Action-for-mutation split (CLAUDE.md §3/§7) — which calls
  `parseWorkLogWorkbook` then checks parsed dates against existing `WorkDay` rows and flags each
  group `isDuplicate`. The confirm step is a genuine Server Action
  (`src/lib/actions/import-actions.ts` `importWorkLogAction`) that re-validates the browser's
  selected groups from scratch with a dedicated Zod schema (`src/lib/validation/import.ts`) —
  never trusting the preview it already saw, per spec §33 — before calling
  `importWorkDayGroups` (`src/lib/data/import.ts`), which skips (not upserts) any date that
  already has a `WorkDay` row, per spec §30's "do not overwrite existing data automatically."
  UI: `src/components/import/import-wizard.tsx`, a client component (this app's first one doing
  a `fetch` round-trip rather than a native form — file upload plus an interactive preview
  genuinely need client state, unlike every prior page) — duplicates and rows with errors are
  unchecked and disabled by default, requiring the user to actively fix-and-re-upload rather
  than accidentally re-importing a day. `/import` added to the header nav. 18 new Vitest tests
  (round-tripping `buildWorkLogWorkbook` output back through `parseWorkLogWorkbook`, header
  rejection, per-row error cases, and the date/time inverse-parser round trips) and 2 new
  Playwright tests (upload→preview→confirm→DB-verify happy path, and duplicate flagging) — 206
  Vitest + 16 Playwright total, all passing; typecheck/lint/build clean (`next build` run
  directly, same P1001 workaround as Phase 8). Also manually verified in a real browser
  (upload, preview with a mix of a new day, a holiday, and an intentionally-invalid Task ID row,
  confirm, then checked the imported day's Work Log page rendered the correct check-in/out,
  break, net duration, both tasks, and the preserved hyperlink) — all test data cleaned up
  afterward. **Environment-only finding, not a product bug:** this machine runs multiple
  unrelated projects' dev servers, and another session's (`GIDC_Website_FE`, an unrelated
  Next.js site) was already bound to port 3000 when Playwright's `webServer` (with
  `reuseExistingServer: true`) went looking — it silently reused that wrong server, so the first
  e2e runs this phase loaded a completely different website instead of failing loudly. Fixed by
  making the port configurable in `playwright.config.ts` via a `PLAYWRIGHT_PORT` env var
  (default still `3000`, so normal single-project usage is unchanged); this session ran
  `PLAYWRIGHT_PORT=3010 npm run test:e2e`. If e2e tests ever seem to hit an unrecognized page
  again, suspect a port collision with another process on the machine before assuming a routing
  bug — check what's actually listening on the configured port.
- Phase 10 is complete: Security & Hardening per spec §41 — authentication/authorization,
  validation review, security review, database constraints, error handling, environment
  variables, performance, accessibility, responsive design, then the full test suite. Confirmed
  the auth approach with the user before implementing, since spec §30/§38 leave it entirely
  optional (see the new §3 "Auth (Phase 10)" entry for the full design — single shared bcrypt
  password, custom signed-cookie session, `src/proxy.ts` gating every route). Key pieces:
  `src/lib/auth/{session,password}.ts`, `src/lib/actions/auth-actions.ts`
  (`loginAction`/`logoutAction`), `src/app/login/page.tsx` +
  `src/components/auth/login-form.tsx` (controlled `useActionState` form, same Phase 4 pattern
  as every other form), `scripts/hash-password.ts` (generates
  `AUTH_PASSWORD_HASH`/`SESSION_SECRET`), `Header` now hides itself on `/login` and adds a
  "Log Out" control. **Two real, non-obvious bugs found and fixed this phase, both documented in
  full in §3:** (1) Next's `.env` loader mangling `$` characters in the raw bcrypt hash —
  base64-encoding `AUTH_PASSWORD_HASH` fixed it, confirmed both broken and fixed by testing
  directly against `@next/env`'s `loadEnvConfig`, not just observing symptoms in the browser; (2)
  Next 16's `middleware.ts` → `proxy.ts` rename mid-version, caught from the dev server's own
  deprecation warning during this phase's first e2e run, migrated via `@next/codemod` (whose
  `--dry` flag turned out not to prevent the actual file rename — worth knowing next time).
  **Database constraints:** a new hand-written-SQL migration
  (`20260825115715_add_check_constraints`) adds Postgres `CHECK` constraints mirroring the Zod
  layer's invariants (non-negative durations, Check Out after Check In, proficiency percentage
  in range) — see the new §3 entry; verified with a dedicated integration test that bypasses Zod
  entirely and confirms the database itself rejects bad writes. **Security/validation/error-
  handling review (spec §33/§34/§38), all passed with no code changes needed except the
  `.env.example` fix below:** grepped for `$queryRaw`/`$executeRaw` (only `/api/health` and
  `scripts/verify-db.ts` use raw SQL, both fixed-literal `SELECT 1`, no interpolation, no
  injection surface); grepped for `error.message`/raw error forwarding in every Server
  Action/Route Handler (none found — errors are already caught and translated to generic
  user-facing messages everywhere, matching the established `tolerateAlreadyDeleted`/import
  patterns from earlier phases); confirmed `.env` is genuinely gitignored and no real credential
  ever appears in a tracked file (`CLAUDE.md`, `DEPLOYMENT.md`, `.env.example` all grepped for
  the actual Neon password — clean). **Found and fixed one real, unrelated environment-hygiene
  bug while reviewing "environment variables" per spec §38: `.env.example` was stale from initial
  scaffolding** — it referenced `DIRECT_URL` and a generic "Prisma Postgres/console.prisma.io"
  setup that was never actually used (the real setup, decided in Phase 0, uses
  `DATABASE_URL_UNPOOLED` via the Vercel-Neon integration, and `DEPLOYMENT.md` already documented
  this correctly — only `.env.example` had drifted). Fixed to match reality, plus the two new
  auth vars. **Performance:** grepped for per-iteration `await prisma` calls across
  `src/lib`; the only one found is `importWorkDayGroups`'s per-group/per-task loop
  (`src/lib/data/import.ts`), which is an accepted, bounded case (a handful of days per manual
  import, each needing its own independent transaction/success-or-skip outcome) — not "fixed"
  since correctness there matters more than batching a low-frequency, small-N operation.
  Indexes on every FK (`workDayId`, `taskId`, `skillId`) already existed from Phase 2.
  **Accessibility/responsive:** spot-checked via a real browser and the accessibility tree (every
  interactive element has a clear accessible name; the login form uses `aria-invalid` +
  `role="alert"` on its error state, same pattern as every other form in the app) — confirmed 11
  files already use responsive Tailwind breakpoints from earlier phases; a dedicated
  mobile-viewport rendering check wasn't completed this session (the browser tool's
  `resize_window` call didn't actually change the CDP-visible viewport in this environment,
  confirmed via `window.innerWidth` still reading the original size after the call) — flagging
  this as unverified rather than claiming it was checked, same honesty standard as the Phase 7
  holiday-row-layout caveat. **Playwright now requires authentication for every spec:** a new
  `setup` project (`e2e/auth.setup.ts`) logs in once and saves the session cookie to
  `playwright/.auth/user.json` (gitignored); the main `chromium` project depends on it and reuses
  that `storageState`, so none of the pre-existing specs needed to change. `e2e/auth.spec.ts`
  deliberately needs a session-less browser context, so it runs on its own
  `chromium-unauthenticated` project instead (no `storageState`, no dependency on `setup`) — the
  two projects' `testMatch`/`testIgnore` keep them mutually exclusive. A new `E2E_TEST_PASSWORD`
  env var (local `.env` only, never used by the app itself) lets `auth.setup.ts` and
  `auth.spec.ts` log in without hardcoding the real password in committed test code. 17 new
  Vitest tests (session token sign/verify/tamper/expiry, password verify against a real
  test-generated hash, the two new CHECK-constraint-bypassing integration tests) and 5 new
  Playwright tests (redirect-when-unauthenticated, 401-not-redirect for `/api/*`, wrong password,
  correct-password-login-then-logout) — 223 Vitest + 21 Playwright total, all passing (re-ran the
  full e2e suite with `--workers=1` after a 3-worker run flaked on 2–3 unrelated specs
  simultaneously; all 21 passed reliably standalone, matching the already-documented
  parallel-worker-contention pattern from Phases 7–8, not a regression from this phase's
  changes). `next build` clean (`ƒ Proxy (Middleware)` correctly listed, `/login` present as a
  static route). Manually verified end-to-end in a real browser: wrong password shows an inline
  error without losing what was typed (controlled input, Phase 4 pattern), correct password logs
  in and redirects to `/dashboard`, "Log Out" clears the session and redirects to `/login`,
  visiting a protected page afterward redirects again. **Not started this phase, deliberately
  out of scope:** deploying to Vercel for real (Phase 11) — the auth env-var setup is written and
  locally verified in `DEPLOYMENT.md` §6 step 5 but not yet exercised against an actual Vercel
  project.
- Phase 11 is complete: Final QA per spec's checklist (Work Logging, Time, Holidays, Skills,
  Excel, Responsive, Browser — "fix all discovered issues, then STOP") plus the §42 Final
  Quality Requirement checklist. This was a real manual QA pass through a live, authenticated
  browser session, not a re-read of existing tests — and it found two genuine bugs neither the
  existing 224 Vitest tests nor the 21 (now 22) Playwright tests had caught, both now fixed with
  regression coverage:
  - **"Remove holiday" (toggle off + Save) silently failed validation every single time,
    forever, since Phase 3.** `WorkDayHeader`'s `holidayReason` `<Input>` is only rendered while
    `isHoliday` is true — so unmarking a holiday removes that field from the DOM, and
    `FormData.get("holidayReason")` returns `null` (not `undefined`) for a field that isn't
    present. Zod's `.optional()` accepts `undefined` but rejects `null` outright, so
    `workDayEditSchema.safeParse(...)` always failed on exactly this submission shape,
    `updateWorkDay` was never called, and the holiday was never actually removed — the UI just
    silently ate the click. Fixed in `updateWorkDayAction`
    (`src/lib/actions/workday-actions.ts`) with `formData.get(x) ?? undefined` on both optional
    string fields. **This is a general FormData/Zod gotcha, not specific to holidays: any
    conditionally-rendered optional text field will hit the identical bug** — checked every
    other Server Action's `formData.get()` calls and confirmed no other field in the app is
    conditionally rendered the same way (Task's `link`, Skill's `notes`, WorkDay's own `notes`
    are all unconditionally in the DOM, so they submit `""` rather than being absent). If a
    future form conditionally renders an optional field, coerce `null` to `undefined` before
    the Zod call, the same way.
  - **`WorkDayHeader`'s local form state (`isHoliday`/`holidayReason`/`notes`) never re-synced
    after a successful save.** `useState(workDay.isHoliday)` only reads the prop on first mount;
    Save re-renders the same client component instance with fresh server props, and without an
    explicit re-sync the switch/reason/notes kept showing whatever was on screen right before
    the click. Fixed with the same signature-comparison "adjust state during render" pattern
    already established in `TimeTrackingCard` (§3) — not an effect, which would trip
    `react-hooks/set-state-in-effect` and cost an extra render. **Any future form component in
    this app that holds local `useState` seeded from a server prop and can be re-rendered with
    new props without unmounting (i.e. anything using `useActionState` on a page that doesn't
    navigate away) needs this same pattern — `WorkDayHeader` was the one remaining form built
    before this pattern was established in Phase 4 and never retrofitted.**
  - Both bugs were caught the same way: actually clicking Save and reloading the page to check
    what persisted, not just checking that the UI looked right immediately after clicking — a
    lesson worth repeating for any future manual QA pass in this app.
  - Root-caused by writing a Zod repro script rather than guessing (`z.object({...}).safeParse({
    holidayReason: null })` reproduces the exact "expected string, received null" error in
    isolation), and by reading `updateWorkDayAction`'s FormData parsing directly rather than
    assuming the schema had a cross-field refine that didn't exist.
  - `e2e/worklog.spec.ts`'s holiday-toggle assertions were rewritten to actually click Save and
    reload after each toggle direction (the old version only checked client-side field
    visibility, toggling on then off without ever saving — which is exactly why it never caught
    this).
  - **Delete Work Day, added this phase after confirming with the user.** The QA checklist
    listed "delete work day" as something to test, but grepping the codebase found no such
    function anywhere — traced back to the original spec and confirmed it's a genuine spec
    inconsistency: Phase 3 (§41), the phase actually responsible for building WorkDay CRUD, only
    ever asked for "WorkDay creation, WorkDay editing" — never deletion — and no other spec
    section (§7, §16, §32) requests it either. The QA checklist appears to have listed it by
    parallelism with Task's create/edit/delete pattern rather than reflecting an actual
    requirement. Asked the user rather than guessing; they confirmed adding it.
    `deleteWorkDay` (`src/lib/data/workday.ts`) uses `tolerateAlreadyDeleted` like every other
    id-keyed mutation (§3); Tasks cascade-delete via the existing `onDelete: Cascade` FK.
    `deleteWorkDayAction` (`src/lib/actions/workday-actions.ts`) is `void`-returning and calls
    `redirect("/dashboard")` directly rather than returning `ActionState`, since — unlike every
    other WorkDay mutation — this one removes the record the current `/worklog/[date]` page is
    showing, so there's nothing left to revalidate in place; lands on `/dashboard`, same
    destination as `logoutAction`. UI: a "Delete Work Day" button + the same shadcn
    `AlertDialog` confirmation pattern already used for Task/Skill deletes (§3: never
    `window.confirm()`), in `WorkDayHeader`.
  - **Removed `date-fns` as an unused dependency** (§42: "no unnecessary deps") — grepped every
    file under `src/`/`scripts/`/`prisma/` and confirmed zero imports; it was the original
    Phase 0 pick, but the project ended up using only the hand-written `src/lib/domain/date.ts`
    utilities. Tech stack table (§2) corrected to match.
  - Full manual pass through every checklist category in a real authenticated browser session
    (not just re-reading existing test coverage): Work Logging (create/edit/multi-task/
    reorder/link/timer — plus the new delete), Time (check in/out/invalid-time validation/
    duration-discrepancy warning), Holidays (create/edit/remove, all the way through the bug
    above, plus a real Excel export of the resulting holiday row read back and verified), Skills
    (create/edit/delete/percentage-crossing-a-category-boundary/history/task association), Excel
    (verified a real multi-day range export — built from actual UI-created data, not synthetic
    fixtures — covering multiple dates, multiple tasks with merged cells, a hyperlink, and two
    holiday rows, all in one file). **Responsive (desktop/tablet/mobile) could not be verified
    this session** — the browser tool's `resize_window` reported success but never actually
    changed the rendered viewport (confirmed via `window.innerWidth` staying at the original
    size both times, tested on a fresh tab created before navigating too) — flagging this as
    genuinely unverified rather than claiming it was checked, matching the honesty standard set
    by the Phase 7 holiday-row-layout caveat. Code-level responsive patterns (Tailwind `sm:`/
    `md:`/`lg:` breakpoints across 11 files, `overflow-x-auto` on nav and every data table) were
    confirmed present in Phase 10 and remain unchanged. **Browser (Chromium/Playwright
    coverage)** is satisfied by the existing suite — no separate action needed. §42 checks:
    `npx prisma db seed` re-run cleanly (idempotent, 0 created/25 already existed); no
    `TODO`/`FIXME`/stray `console.log` anywhere in `src`/`e2e`/`scripts`/`prisma`; no console
    errors across a sweep of every page (dashboard, worklog, calendar, skills, reports, export,
    import, settings); grepped for the real Neon password and the local dev login password
    across every tracked doc/config file — clean, only ever in the gitignored `.env`. 224 Vitest
    (1 new: `deleteWorkDay` P2025-tolerance) + 22 Playwright (1 new: the delete-work-day flow)
    total, all passing; `next build` clean.
- Update the Phase Progress table and this file at the end of every phase.
- **Next.js 16 has a built-in "agent rules" feature that appends a block to `CLAUDE.md` on
  every `next dev` run** (`node_modules/next/dist/server/lib/generate-agent-files.js`). We
  disabled it (`agentRules: false` in `next.config.ts`) because this file is our own
  hand-maintained source of truth, not Next's auto-generated one. If this file ever shows a
  `<!-- BEGIN:nextjs-agent-rules -->` block appended at the bottom, it means that config got
  lost — remove the block and re-check `next.config.ts`.
