# Deployment Guide — WorkLog Manager

Target architecture:

```
User → Vercel → Next.js → Prisma (v7, driver adapter) → Neon Postgres (managed)
```

No step in this app depends on `localhost`, a locally installed Postgres server, local
filesystem persistence, or SQLite. Both local development and production point at Neon Postgres
instances (different databases, same provider — see §11).

This doc is written to be followed by someone who has never used Prisma + Postgres before.
Steps marked **[Manual — you do this]** require your browser/account and cannot be done by
Claude on your behalf.

**Note on Prisma version:** this project uses **Prisma 7**, which changed how database
connections are configured compared to Prisma 6 and earlier (no more `url`/`directUrl` in
`schema.prisma`; a `prisma.config.ts` file plus a driver adapter are required instead). Every
command and file below reflects the v7 way. If you ever see older Prisma tutorials showing
`directUrl` inside the `datasource` block, that's the pre-v7 pattern — don't follow it here.

---

## 1. Creating the PostgreSQL Database

**[Manual — you do this]** — **already done** for the dev database, using the Vercel-Neon
marketplace integration (Vercel dashboard → Storage → Create Database → Neon Postgres). That
flow provisions a Neon project and writes connection-string env vars for you.

For a **separate production database** (recommended, see §11), repeat the same flow — either a
second Neon Postgres resource through the same Vercel integration, or directly at
console.neon.tech. Pick a region close to where the app will actually run.

## 2. Getting Connection Strings

**[Manual — you do this]** — **already done** for the dev database; `.env` already contains
both.

The Vercel-Neon integration provides two connection strings sharing the same credentials but
different hostnames:
- **Pooled** (`DATABASE_URL`) — hostname contains `-pooler`, e.g.
  `postgresql://USER:PASS@ep-xxxx-pooler.REGION.aws.neon.tech/DBNAME?channel_binding=require&sslmode=require`
- **Direct/unpooled** (`DATABASE_URL_UNPOOLED`) — same hostname without `-pooler`, e.g.
  `postgresql://USER:PASS@ep-xxxx.REGION.aws.neon.tech/DBNAME?sslmode=require`

We kept these exact variable names (rather than renaming to `DIRECT_URL`) so that if you ever
reconnect the Neon integration in Vercel, it can auto-sync matching names into every deploy
environment without manual copying.

Why two strings: the pooled connection is what the running app uses for normal queries (handles
many concurrent short-lived connections cheaply — important for serverless). The direct
connection is what Prisma's CLI uses for migrations and seeding, because pooled connections
don't support the session state and DDL operations migrations need. Using the pooled string for
a migration produces confusing errors (lock/prepared-statement failures); using the direct
string for all app traffic works at low volume but exhausts connections under real load.

## 3. Configuring Local `.env`

**Already done.** For reference, this is the shape (`.env.example` has placeholders only, safe
to commit):

```
DATABASE_URL="postgresql://USER:PASS@ep-xxxx-pooler.REGION.aws.neon.tech/DBNAME?channel_binding=require&sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://USER:PASS@ep-xxxx.REGION.aws.neon.tech/DBNAME?sslmode=require"
```

Under Prisma 7, `prisma/schema.prisma` does **not** contain a connection string at all:

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

Instead, `prisma.config.ts` (repo root) tells the **Prisma CLI** which connection to use for
migrations — the direct one:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
```

And `src/lib/db.ts` builds the **runtime** client with the pooled connection, via the Neon
driver adapter (required in v7 — there's no more "just pass a url string" option):

```ts
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });
```

Two npm packages are required beyond `prisma`/`@prisma/client` for this to work:
`@prisma/adapter-neon` and `@neondatabase/serverless` (the adapter's underlying driver, uses
WebSockets — works in serverless/edge runtimes where raw TCP `pg` connections don't).

## 4. Running Migrations (local/dev)

```bash
npx prisma migrate dev --name init
```

Reads `prisma.config.ts` → `DATABASE_URL_UNPOOLED`, creates/updates the schema, and writes a
migration file under `prisma/migrations/`. Every subsequent schema change gets its own
`prisma migrate dev --name <change>` — migration files are committed to git; they're the
record of every schema change, not something regenerated on demand.

`prisma migrate dev` is a **development-only** command — it can reset/drop data if migrations
have drifted. Never run it against the production database. Production always uses
`prisma migrate deploy` (§8).

**Verified 2026-08-24:** `npm run db:verify` (a small script at `scripts/verify-db.ts` running
`SELECT 1` through the pooled adapter) succeeded, and `npx prisma migrate dev` connected
successfully through the direct URL (no models existed yet at that point, so it reported
"already in sync" rather than writing a migration file — the real first migration happens in
Phase 2 once domain models exist).

## 5. Seeding the Database

```bash
npx prisma db seed
```

Runs `prisma/seed.ts` (added in Phase 2), which seeds the initial SkillMap data from spec.
Seeding is idempotent (upserts by unique key) so re-running it is safe, but it's a
manual/deliberate action — never wired into automatic build or deploy steps, since running it
against production should be a conscious choice, not a side effect of deploying.

## 6. Configuring Vercel Environment Variables

**[Manual — you do this, when ready to deploy]**

1. If the dev database was connected via the Vercel-Neon integration, Vercel may already have
   `DATABASE_URL`/`DATABASE_URL_UNPOOLED` set for that project/environment — check
   **Settings → Environment Variables** first before adding anything.
2. For a **separate production Neon database** (§11), add `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` scoped to the **Production** environment, pointing at the
   production database — not the dev one.
3. If Preview deployments should also hit a database, add the same two variables scoped to
   **Preview** (can point at the dev database, or a third dedicated preview database).
4. These are configured in the Vercel dashboard only, never committed to git.
5. **Auth (Phase 10)** — also add `AUTH_PASSWORD_HASH` and `SESSION_SECRET`. Generate both with:
   ```bash
   npm run auth:hash-password -- 'your-chosen-password'
   ```
   This prints two lines ready to paste as-is into Vercel env vars (or `.env` for local dev) —
   scope both to every environment (Production, Preview, and Development if you use `vercel env
   pull`). **Paste `AUTH_PASSWORD_HASH` exactly as printed — it's already base64-encoded, not the
   raw bcrypt hash.** The app always base64-decodes this value before comparing (see
   `src/lib/auth/password.ts`), because Next.js's own `.env` loader (`@next/env`, via
   dotenv-expand) treats `$` as shell-style variable-expansion syntax and silently mangles a raw
   `$2b$12$...` bcrypt hash — confirmed during Phase 10 that this happens for **local dev** even
   though Vercel's dashboard-injected env vars aren't run through that same expansion. Pasting a
   raw (non-base64) hash into Vercel would still *look* configured but silently reject every
   login, since `verifyPassword` always attempts to base64-decode first — always use the
   script's output verbatim, on every environment, not just locally. `SESSION_SECRET` is a plain
   random hex string (no `$` in it) and isn't affected by this, but generate it the same way for
   convenience. Rotating either value logs everyone out (all existing session cookies stop
   verifying) — that's expected, not a bug.

## 7. Deploying

**[Manual — you trigger this, Claude will not deploy without being explicitly asked]**

Two common paths:
- **Git integration (recommended)**: connect the GitHub repo to a Vercel project; every push to
  `main` triggers a production deploy, every PR gets a preview deploy.
- **CLI**: `vercel` (preview) / `vercel --prod` (production), from the project root once the
  Vercel CLI is installed and logged in.

Either way, Vercel runs `npm install` then the configured **build command**.

## 8. Running Production Migrations

`package.json` (final form, once Next.js is scaffolded in the rest of Phase 1):

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma migrate deploy && next build"
  }
}
```

- `postinstall: prisma generate` — Vercel's build does **not** run this automatically; without
  it, Prisma Client is stale/missing (`src/generated/prisma` is gitignored, it must be
  regenerated on every install) and the build fails at import time.
- `build: prisma migrate deploy && next build` — applies any migrations committed under
  `prisma/migrations/` that haven't been applied to the target database yet, using
  `DATABASE_URL_UNPOOLED` (read from `prisma.config.ts`, which reads `process.env` — so this
  env var must exist in whichever Vercel environment is building). `prisma migrate deploy`
  **never** generates new migrations and never resets data — it only applies what's already
  committed. If it fails, `&&` stops the build before `next build` runs, so a broken migration
  never ships a broken schema behind a working app.

`prisma db push` is never used as the deploy mechanism — every schema change is a reviewable,
committed migration file.

## 9. Verifying the Production Database

After a deploy:

1. Check the Vercel build log — confirm `prisma migrate deploy` ran and reported migrations
   applied (or "No pending migrations" on a no-op deploy).
2. Hit `/api/health` (a minimal route that runs `SELECT 1` via `prisma`) and confirm it returns
   success — proves the deployed app can actually reach the database, not just that the build
   succeeded.
3. Spot-check one real read (e.g. the dashboard loads without error) and, if seed data is
   expected, that it's present.
4. Confirm indexes exist as defined in `schema.prisma` — `prisma migrate deploy` applies them
   as part of the migration; nothing to do manually unless a migration was edited by hand
   (which it shouldn't be).

Do not consider a phase touching the database "done" until this verification has actually been
run — not merely that `migrate deploy` exited 0.

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `prisma migrate dev`/`deploy` hangs or errors with prepared-statement/lock messages | Ran migration against the **pooled** URL | Confirm `prisma.config.ts` → `datasource.url` reads `DATABASE_URL_UNPOOLED`, not `DATABASE_URL` |
| App works locally, connections mysteriously fail/exhaust under light concurrent use in prod | Runtime client built with the direct/unpooled connection instead of pooled | Confirm `src/lib/db.ts`'s `PrismaNeon` adapter reads `DATABASE_URL` (pooled), not `DATABASE_URL_UNPOOLED` |
| `Cannot find module '@prisma/client/runtime/client'` when running any script that imports the generated client | `@prisma/client` isn't installed — the new `prisma-client` generator's output still depends on it internally, even though you import from `src/generated/prisma`, not `@prisma/client` directly | `npm install @prisma/client` |
| TS errors on generated client files, or `allowImportingTsExtensions` complaints | Generated client imports use explicit `.ts` extensions internally | `tsconfig.json` needs `moduleResolution: "bundler"` and `allowImportingTsExtensions: true` (already set — don't remove if regenerating tsconfig) |
| `prisma generate`/`migrate` ignores `.env` or wrong values | Old Prisma 6-style config still assumed a `url` field directly in `schema.prisma` | Under v7 that field doesn't exist — connection strings only come from `prisma.config.ts` (CLI) and the driver adapter in `src/lib/db.ts` (runtime) |
| Vercel build fails with "Prisma Client not generated" / stale-client type errors | `prisma generate` didn't run | Confirm `postinstall: "prisma generate"` is present in `package.json` |
| Vercel build fails during `prisma migrate deploy` | A migration is invalid, or `DATABASE_URL_UNPOOLED` isn't set in Vercel env vars for that environment | Check Vercel env vars are configured for the environment being deployed (Production vs Preview); test the migration against a scratch database first |
| Env vars not found at runtime | Only added to one Vercel environment (e.g. Production) but a Preview deploy is failing | Add the vars to every environment that needs them |
| Local dev suddenly can't connect | `.env` missing, mistyped, or `sslmode=require`/`channel_binding=require` dropped when copy-pasting | Re-copy both strings from the Neon/Vercel dashboard exactly |
| Migration works locally but production schema drifts from what's expected | Someone ran `prisma db push` or hand-edited the DB instead of a migration | Never use `db push` outside local experimentation; if drift happens, resolve it with `prisma migrate resolve`, not by hand-editing production |
| Seed data missing in production | Seeding isn't automatic (intentional) | Run `npx prisma db seed` manually once, pointed at the production `DATABASE_URL_UNPOOLED`, as a deliberate action |
| `npm audit` shows a high-severity `deepmerge-ts` advisory | Transitive dependency of Prisma's own `@prisma/config` package (dev-tool only) | Don't run `npm audit fix --force` — it downgrades to Prisma 6. Known upstream issue, tracked in `CLAUDE.md` §3, revisit when Prisma patches it |
| Login always says "Incorrect password" even with the right password | `AUTH_PASSWORD_HASH` was pasted as the raw `$2b$12$...` bcrypt hash instead of the script's base64-encoded output (Next's `.env` loader mangles `$` characters — see §6 step 5) | Regenerate with `npm run auth:hash-password -- 'your-password'` and paste that line exactly, don't hand-edit it |
| Login always says "Incorrect password" no matter what's typed, even the right password | `AUTH_PASSWORD_HASH` or `SESSION_SECRET` missing in that environment — both fail closed by design (never falling through to "authenticated"), and a missing/invalid hash makes every password attempt fail the same generic way, not a distinct error | Confirm both are set in Vercel for the environment being hit (Production vs Preview), or in local `.env` |

## 11. Separate dev/prod databases

Use **two** Neon Postgres database instances, not one shared between local dev and production:
one for local development (`.env`), one for production (Vercel env vars). This means schema
experiments, seed re-runs, or a bad manual query during development can never touch real
submitted work-log data. The dev one already exists; create the production one (§1) before the
first real deploy (Phase 10/11), not before it's actually needed.

---

**Status:** Sections 1–4 (database creation through first local migration) are done and
verified as of 2026-08-24. §6 step 5 (auth env vars) is written and verified locally as of
2026-08-25 (Phase 10) — `npm run auth:hash-password` generates a working credential pair,
confirmed end-to-end via a real browser login/logout. Sections 6 (steps 1–4)–9 (Vercel env
vars, deploy, production migration, production verification) are written but not yet executed
against a real Vercel deployment — they'll be validated for real during Phase 11 when the app
is actually deployed. Update this file if anything turns out to work differently in practice.
