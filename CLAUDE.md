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

**Visual design system (added post-Phase-11, on user request — "make the UI stunning,
attractive, professional, more color/icons, not childish"):** the original build used shadcn's
default zero-chroma neutral theme throughout (literally `oklch(x 0 0)` for every token) with no
icons — functional but flat. `src/app/globals.css` now defines a real palette: `--primary` is an
indigo/blue (`oklch(0.5 0.2 264)`), plus `--success` (green), `--warning` (amber), and a new
`--info` (sky blue) token, each with a paired `-foreground` for text-on-fill contrast; `--radius`
bumped to `0.75rem` for a softer, more modern corner radius; `body` carries a very subtle two-tone
radial-gradient backdrop (primary + success, ~5-10% opacity, `background-attachment: fixed`) for
depth without being distracting. All of this is dark-mode-mirrored the same way the original
tokens were. `Badge` (`src/components/ui/badge.tsx`) gained `success`/`warning`/`info` variants
alongside the existing default/secondary/destructive/outline; `Progress`
(`src/components/ui/progress.tsx`) gained an `indicatorClassName` prop so callers can override
the fill color per-instance (used by SkillMap's proficiency bars — see below). `lucide-react`
icons (already a project dependency, `iconLibrary: "lucide"` in `components.json`) are now used
throughout: every nav item, every page `<h1>`, every section `<h2>`, and most action buttons
carry a meaningful icon, not decoration for its own sake — e.g. `Header`'s active nav state is
now `bg-primary/10 text-primary` instead of plain gray, `StatTile` takes an `icon`/`accent` pair
so each dashboard/reports stat gets a color-coded icon badge, and SkillMap's proficiency bars are
colored red/amber/green by category band via new `SKILL_CATEGORY_PROGRESS_CLASS`/
`SKILL_CATEGORY_ICON_CLASS` exports in `src/lib/domain/skill.ts` (traffic-light convention,
reusing the existing destructive/warning/success semantic tokens rather than inventing a
skill-specific palette). `WORK_DAY_STATUS_BADGE_VARIANT` (new export in
`src/lib/domain/workday.ts`, alongside the existing `WORK_DAY_STATUS_LABELS`) is the single
source of truth for which `Badge` variant each `WorkDayStatus` renders as — both
`TodayWorkCard` and `RecentWorkDaysTable` import it rather than each defining their own copy.
**Two real bugs found via e2e test failures during this pass, both fixed:** (1) manual "+ Add
Skill"/"+ Add Task" button text was replaced with an icon + plain text ("Add Skill"/"Add Task"),
which required updating the 5 e2e assertions that matched the literal "+" — same treatment for
Calendar's "← Prev"/"Next →" links (now icon + "Prev"/"Next", `e2e/calendar.spec.ts` updated to
match); (2) giving `TimeTrackingCard`'s status line an actual `Badge` (previously plain muted
text) meant it now also renders literal text "Holiday" whenever `isHoliday` is true (holiday
always overrides `WorkDayStatus`, CLAUDE.md §5) — this collided with `WorkDayHeader`'s own new
Holiday badge on the same page, breaking an unscoped `e2e/worklog.spec.ts` locator; fixed by
scoping that locator to `WorkDayHeader`'s `<section>` specifically via an xpath-ancestor query
(same pattern already used in `skillmap.spec.ts`). **Found, not fixed (out of scope for a
styling pass — flagged to the user):** `/settings` is still literally `PagePlaceholder` — no
Holiday reference-calendar CRUD UI was ever built despite `src/lib/data/holiday.ts` existing
with `createHoliday`/`getHolidayByDate`/`listHolidays` and CLAUDE.md's own folder-structure
comment calling it out as "holiday calendar config." The placeholder's copy was corrected from
the inaccurate "Built in {phase}." to "Planned for {phase} — not yet built." (and
`page-placeholder.test.tsx` updated to match) so it reads as an honest gap rather than a broken
claim. Verified: 224 Vitest + 22 Playwright (1 pre-existing, already-documented parallel-worker
flake in `skillmap.spec.ts`, confirmed non-regressing by re-running standalone twice), `next
build` clean, and every page spot-checked visually in a real authenticated browser session.

**Second design pass (user: "lot of unnecessary space... whole web looks blend"):** tightened
`<main>` padding (`py-6`→`py-5`), bumped `--primary` chroma slightly and added a violet gradient
stop to the body backdrop, gave `StatTile` a colored left-accent bar
(`absolute inset-y-0 left-0 w-1`, driven by a new `ACCENT_STYLES` icon/bar pair) plus tighter
padding, and diversified per-page accent hues beyond the single primary blue (teal for
Calendar/Import, violet for Skills, cyan for Reports) using Tailwind's built-in palette directly
rather than adding new design tokens for one-off hues. Several "hero" cards (`TodayWorkCard`,
`WorkDayHeader`, `TimeTrackingCard`, the Export cards) picked up a `border-l-4 border-l-primary`
accent border. Swept `border-dashed p-6` → `p-5` empty-state padding across 7 table/list
components for consistency.

**Working Days (user: export "only exporting some days for month" — root cause: an export only
ever contains WorkDay rows that exist in the DB, i.e. dates someone actually visited; there was
no concept of "the days I'm normally supposed to work").** Added a genuine singleton config row —
`AppSettings` (`id: "singleton"`, `workingDays Int[] @default([1,2,3,4,5])`, Sun=0..Sat=6) — the
first schema table in this app that isn't per-WorkDay/Task/Skill domain data but whole-app
config; `src/lib/data/settings.ts`'s `getWorkingDays`/`updateWorkingDays` `upsert` on that fixed
id rather than requiring a seed step. `src/lib/domain/workday.ts`'s new `fillMissingWorkingDays`
takes the real WorkDay rows in a range plus the working-days config and synthesizes a
`BlankExportDay` (same shape a genuine zero-task day already renders as — checkIn/checkOut null,
tasks `[]`) for every configured working day in range that has no real row yet, capped at
`today` (never invents rows for days that haven't happened). `/api/export`'s route handler calls
it before building the workbook, so every export now has one row per expected working day, not
just visited ones. New `/settings` page (`WorkingDaysForm`, a controlled 7-checkbox
`useActionState` form, same pattern as every other form in this app) replaces what had been a
literal `PagePlaceholder` — this closes the "Holiday reference-calendar... never built" gap note
above only insofar as `/settings` now does something real; a Holiday CRUD UI is still not built
(same out-of-scope flag as before). `PagePlaceholder` and its test were deleted as dead code once
Settings became real. A genuine bug surfaced immediately after this feature shipped: the dev
server's already-loaded Prisma client didn't know about the new `AppSettings` model until both
`npx prisma generate` was re-run *and* `next dev` was restarted (Turbopack's watcher doesn't
pick up a regenerated `src/generated/prisma` output on its own) — worth checking first if a
freshly-migrated model 500s with "Cannot read properties of undefined" immediately after a schema
change.

**Third pass — full UI/UX ownership handoff (user: "take ownership of improving the UI/UX of
this entire application... inspect yourself... actually implement the improvements," explicitly
declining to specify a palette/layout/component spec).** This was a genuine audit-then-fix pass,
not another color/spacing tweak: every page was inspected in a real authenticated browser first
(read-only — see the data-safety note in §3's testing-commands guidance), and the fixes target
findings from that inspection, not guesses.
- **New `src/components/layout/page-header.tsx` (`PageHeader`)** replaces ~7 near-identical but
  subtly-drifted inline copies of the "icon badge + `<h1>`" block that had accumulated one page
  at a time (Dashboard was actually missing a page title/header entirely — the one page that had
  never gotten one, found only by looking, not by grepping for the pattern). Takes
  `icon`/`title`/`description?`/`accent?`/`actions?`; `accent` covers the semantic tokens plus the
  handful of one-off Tailwind hues (teal/violet/cyan) already in use. Dashboard, Skills, Export,
  Import, Reports, Settings, and the Calendar month page (which also folded its Prev/Next buttons
  into `actions`) all switched to it.
- **Dialed back the `border-l-4` accent border** added in the second pass: it had spread to
  Export's two cards, Import's upload card, and the Settings form — on a single-card page a left
  accent border communicates nothing (there's nothing to distinguish it from), so it stayed only
  on genuine "this is the primary thing on a multi-section page" cases (`TodayWorkCard`,
  `WorkDayHeader`, `TimeTrackingCard`) and was removed from `ExportQuickLinks`, `ExportRangeForm`,
  `WorkingDaysForm`, and the Import upload card.
- **Export and Import were the two weakest pages by far** — a single small card floating in most
  of an empty viewport, not because of the app's actual scope but because the pages never grew any
  real content beyond the bare form. Both got a `lg:grid-cols-[1fr_18rem]` layout with a static
  info-panel `<aside>` (what's actually in an export file; how import's duplicate/never-overwrite
  behavior works) — genuinely useful content, not filler, using facts already true per §6/Phase 9
  rather than inventing new copy to pad space.
- **Import's native `<input type="file">`** (`Choose File — No file chosen`, unstyled and
  visually the single worst element in the app) is now a clickable dropzone-styled `<label>`
  wrapping a `sr-only` input that still carries the same `id="import-file"` — `e2e/import.spec.ts`
  locates it by that id and doesn't require visibility for `setInputFiles`, so this didn't need an
  e2e change. Shows the chosen filename once selected.
- **`WorkDayHeader`'s "Delete Work Day" button** was a solid destructive-red outline button sitting
  directly beside the date title — too much visual weight for a rare, already-double-confirmed
  (`AlertDialog`) action on the page used every single day. Restyled to `variant="ghost"` with
  muted text, turning destructive-red only on hover.
- **`CalendarGrid` cells** gained a small status icon (`Clock3`/`CheckCircle2`/`PalmtreeIcon` for
  IN_PROGRESS/COMPLETED/HOLIDAY) alongside the existing color coding — redundant encoding, not
  decoration, so status is legible without relying on hue alone — plus a faint weekend-column
  tint on empty cells for structure in a mostly-blank month.
- **`Header` navigation redesigned for mobile.** The previous `overflow-x-auto` horizontal scroll
  was the entire mobile nav story for 8 items + logout — a weak, undiscoverable pattern the user
  explicitly flagged wanting "intentionally designed" tablet/mobile experiences. The desktop bar
  (`hidden md:flex`, `overflow-x-auto` kept as a safety net, not the primary interaction) is
  unchanged above `md`; below it, a hamburger button toggles a dropdown panel with the same nav
  items stacked vertically plus Log Out, closing on backdrop click or on route change. The
  route-change close uses the same "adjust state during render" comparison pattern as
  `TimeTrackingCard`/`WorkDayHeader` (§3), not `useEffect`+`setState` — caught immediately by
  `react-hooks/set-state-in-effect` at lint time, exactly as that rule is meant to. The mobile
  panel is a plain `<div>`, not a second `<nav aria-label="Primary">`, so
  `e2e/navigation.spec.ts`'s `getByRole("navigation", { name: "Primary" })` still resolves to
  exactly one element.
- **Dialog polish on the two most-used forms.** `TaskFormDialog`: Task ID and Duration (both
  short fields) moved into a `grid-cols-2` row instead of two full-width stacked fields; the
  skills checklist became a 2-column grid with a "N selected" count in its label instead of a
  single narrow scrolling column. `SkillFormDialog`: proficiency now shows a live mini progress
  bar (reusing `SKILL_CATEGORY_PROGRESS_CLASS`/`deriveSkillCategory`) as you type, so which band
  (Less Than 30% / 30 to 70% / More Than 70%) a value lands in is visible before saving, not just
  after. Neither change touches field `name`s, so no Server Action/Zod schema changed.
- **New `src/components/ui/skeleton.tsx`** (standard shadcn pulse skeleton) plus `loading.tsx`
  for Dashboard, `/worklog/[date]`, `/calendar/[month]`, Skills, and Reports — the five genuinely
  data-heavy Server Component pages — so navigating to them shows a layout-shaped skeleton instead
  of a blank frame while data loads.
- **Verification:** 233 Vitest tests, `npm run lint`, and `tsc --noEmit` all clean; `npx next
  build` clean (the same P1001-on-`migrate deploy`-in-this-sandbox workaround as Phases 8/9 —
  ran `next build` directly rather than the full `npm run build` script). Every changed page was
  spot-checked visually in a real authenticated browser session (read-only navigation only, per
  the data-safety constraint in §3). **Not verified this pass:** actual rendered mobile/tablet
  behavior — the browser tool's `resize_window` reports success but the page keeps rendering at
  the original viewport width (same unresolved environment limitation already flagged in Phases
  10–11); the responsive Tailwind breakpoints themselves were verified by code review, not by
  eye, so treat the mobile nav as implemented-but-not-visually-confirmed until a session where
  `resize_window` (or a real device) actually works.

**Fourth pass — dark theme + type + saturation (user, in two messages: "make it more appealing...
too blend, plain and simple," then "I like a darker... not neon... blue and related colors like
purple, black will work fine").** The third pass had fixed structural/consistency problems but
left the app visually restrained (near-white background, mostly flat single-tone surfaces, no
distinctive typography) — this pass pushes the visual language itself, in the direction the user
specified rather than a default guess.
- **Typography:** added `next/font/google` — `Sora` (headings, geometric/distinctive) and `Inter`
  (body) — as CSS variables set on `<html>` in `layout.tsx`, mapped through `@theme inline` as
  `--font-sans`/`--font-heading`. A single `@layer base { h1,h2,h3,h4 { @apply font-heading; } }`
  rule in `globals.css` means every heading across the whole app picked up the new font with zero
  per-component changes — the same "fix the shared layer once" leverage as `PageHeader` in the
  third pass.
- **Dark is now the app's only real theme**, forced via a `dark` class on `<html>` rather than
  `prefers-color-scheme` (this is a single-user personal tool with no theme toggle, not a
  light/dark product — matches the existing "no unnecessary configurability" bias in §1). The
  `:root` (light) token block in `globals.css` is left as-is and unused, purely as a fallback in
  case a toggle gets added later — it isn't reachable today. The `.dark` block's tokens were
  redesigned, not just reused: background dropped to a near-black navy
  (`oklch(0.13 0.016 264)`), and — this is the direct fix for "not neon" — every color's chroma
  was lowered from what the third pass had used (e.g. primary 0.17→0.15, success/info 0.14→0.10-
  0.11), since high-chroma colors read as neon specifically when set against a near-black
  background, not in isolation. Also added `color-scheme: dark` to `.dark`, without which native
  browser controls (the date-input calendar picker, scrollbars) keep rendering in their light
  variant regardless of the app's own palette — an easy miss that looks broken rather than
  intentional.
- **Decorative hues consolidated into blue → indigo → violet/purple only**, dropping teal, cyan,
  and pure Tailwind orange/amber accents that the third pass had introduced for per-page/per-
  gradient variety. This wasn't a search-and-replace of literal color names: semantic status
  colors (success/warning/destructive/info — meaningful, not decorative) kept their hue but
  became **tonal** gradients (e.g. `from-success to-success/70`, not `from-success to-teal-500`)
  rather than jumping to an unrelated hue, since a two-hue gradient is what read as "rainbow/
  neon," not the color itself. `PageHeader`'s `teal`/`cyan` accent keys were kept (call sites
  unchanged — Calendar, Import, Reports still pass them) but now render in blue/indigo internally,
  so the fix lives in one map (`ACCENT_ICON_CLASS`) rather than touching every call site.
  `Badge`'s five color variants went back to flat semantic fills (the third pass had made them
  two-stop gradients) — a small pill at badge size reads busy with a gradient in a way a larger
  surface (a button, an icon badge) doesn't, so gradients stayed only on those larger surfaces.
- **Verification:** 233 Vitest tests, lint, typecheck, and `next build` (direct, same P1001
  workaround as before) all clean; every changed page re-spot-checked visually in the real
  authenticated browser session, including reopening the Add Task dialog to confirm dark-mode
  contrast/readability on form fields, not just top-level pages.

**Fifth pass — rebuilt on a supplied reference design system (user added `design.md` to the repo
root and asked to rebuild the UI from it).** `design.md` is extracted metadata from a marketing
"Interactive Hero" landing-page template (colors/typography/spacing/radius tokens, plus a
Composition/Motion/WebGL section describing a hero section with cursor-follow effects and
"Get started"/"Learn more" CTAs). **Scope decision, not asked but made explicitly:** treated it as
a *token/visual-language reference* to rebuild this app's theme on, not a literal instruction to
build a marketing hero section inside a productivity tool — the Motion/WebGL/CTA-hierarchy
guidance describes a one-screen landing page, which doesn't map onto a dense daily-use dashboard,
and CLAUDE.md's own standing instruction (§"Important" in the original UI/UX-ownership request)
is "do not unnecessarily change functionality/architecture." The token layer was rebuilt for
real, though — this is a genuine "from scratch" retheme of `globals.css`, not a tint adjustment:
  - **Colors taken verbatim from `design.md`**, not approximated: `--background: #050510`,
    `--card`/`--popover` (its "surface" role): `#161f45`, `--primary: #2b44d1`,
    `--accent: #435ef0` (its "secondary"/"accent" — both blue, so this app's `accent` *is* that
    second blue, not a distinct hue), `--foreground: #ffffff`, `--muted-foreground: #a1a1aa`,
    `--border`/`--input: #27272a`. Roles `design.md` doesn't define (`--secondary`/`--muted` as
    neutral surfaces, and the semantic `--success`/`--warning`/`--destructive`/`--info` tokens)
    were derived to sit at a consistent depth/chroma with the rest of that palette rather than
    invented independently — `--info` was simply set equal to `--accent` since design.md's own
    palette is blue-only, so a separate "info blue" would be redundant.
  - **Every decorative violet/indigo/teal/cyan/fuchsia accent from the third and fourth passes
    was swept out**, since `design.md`'s palette is strictly two blues — grepped for all of them
    across `src` and confirmed zero remain. `PageHeader`'s `teal`/`violet`/`cyan` accent keys
    were kept (existing call sites in Calendar/Import/Skills didn't need to change) but now all
    resolve to different intensities of `primary`/`accent` internally, the same "fix the map, not
    the call sites" approach used when those keys were first introduced.
  - **Typography rebuilt per `design.md`'s explicit instruction ("Use Inter for display moments
    and Inter for body copy")** — dropped the fourth pass's second display face (Sora) entirely;
    `next/font/google` now loads only `Inter` (`--font-sans`) and, per design.md's `label-md`
    token, `JetBrains Mono` (`--font-mono`) for short technical labels. `display-lg`'s literal
    64px/weight-500 spec is a landing-page hero headline size — **deliberately not applied
    verbatim** to this app's page titles (would wreck the information-density goal from the
    original UI/UX-ownership request on every single page); headings instead get `font-weight:
    600` + slightly tightened tracking via a `@layer base` rule, keeping Inter's character
    without the hero-scale size. A new `.label-mono` utility (`font-mono text-xs font-semibold`)
    applies the mono treatment specifically to Task IDs — the one genuinely "technical metadata"
    string in this app's data model (`TaskTable`, `TasksByTaskIdTable`, and the Task ID `Input`
    in `TaskFormDialog`) — rather than to UI chrome generally.
  - **Radius**: `--radius` set to `design.md`'s `14px` (its card/control token); swept every
    `rounded-xl` (the old 18px card radius) to `rounded-lg` across the whole `src` tree so it
    resolves to the new 14px value everywhere at once, rather than a token change that silently
    stopped matching most of the actual UI. `rounded-full` (pills — Badge, the mobile-nav close
    button) was already independent of this scale and needed no change.
  - **Login page treated as this app's one deliberate "hero moment"**, closest in kind to what
    `design.md` actually describes: gradient wordmark (`text-gradient-brand`, now `primary→accent`
    only), a `primary→accent` top accent bar, gradient icon badge — the one screen in the app
    where that kind of emphasis is earned (first thing any session sees), left at `rounded-2xl`
    rather than forced to the 14px card scale, matching a hero card's greater visual weight.
  - **Verification:** 233 Vitest tests, lint, typecheck, and `next build` all clean;
    dashboard/login/worklog/skills/calendar/export re-spot-checked visually in the real
    authenticated browser session against `design.md`'s actual hex values, not just "looks dark
    and blue."

**Sixth pass — navbar scrollbar + user-supplied background image.** Two small follow-ups:
- The header nav's `overflow-x-auto` safety net was showing a visible horizontal scrollbar at
  common desktop widths (8 nav items were a few px too wide for the `max-w-6xl` header at default
  padding/gap). Tightened item padding/gap slightly so it fits without scrolling in the first
  place, and added a `.no-scrollbar` utility (`globals.css`) — `scrollbar-width: none` +
  `::-webkit-scrollbar { display: none }` — applied to the nav so the fallback, when it does
  trigger on narrower widths, scrolls without showing a scrollbar track.
- User added `public/background.jpg` (an abstract blue fluid-marble texture) and asked for it as
  the page background in blue/purple/black. Used directly rather than re-derived: `.dark body`'s
  `background-image` is now a diagonal black → purple → black `linear-gradient` wash layered on
  top of `url("/background.jpg")` (gradient listed first — in CSS, earlier `background-image`
  layers paint over later ones), both set to `cover`/`center`/`fixed`. The wash does two jobs at
  once: it's what actually introduces purple (the photo itself is blue-only), and it darkens the
  image enough that `--card` (`#161f45`, opaque) and white body text stay fully legible over it —
  confirmed by checking a text-dense page (`/worklog`), not just the dashboard, since that's where
  a too-bright backdrop would actually hurt readability first. Replaces the pure-CSS-gradient
  backdrop from the fourth pass; the file is a normal Next.js `public/` static asset, ~180KB.

**Seventh pass — readability regressions the background image introduced, plus one contrast bug
that predates it.** The image (fifth/sixth pass) looked good on cards that already had a solid
`bg-card`, but exposed two real gaps:
- **Every table wrapper in the app had no background at all.** `overflow-x-auto rounded-lg
  border shadow-sm` — used by every data table (`RecentWorkDaysTable`, all four Reports tables,
  `TaskTable`, the Import preview table) — never set `bg-card`; the `<Table>` primitive itself
  doesn't either (only `TableHeader`/`TableFooter` get `bg-muted/50`). Before the background image
  this was invisible (the page background was already near-black, close enough to `--card` that
  the missing fill didn't read as a bug); once a busy photo sat behind it, every table row's text
  rendered directly over the image. Fixed by adding `bg-card/85 backdrop-blur-md` to that shared
  wrapper class across all 7 files — a "light glass" surface (per the user's own phrasing) rather
  than fully opaque, since dense tabular text needs more backing than a sparse empty state does.
  The same gap existed in every `border-dashed` empty-state box (`text-muted-foreground
  rounded-lg border border-dashed p-5...`, 7 occurrences) — fixed the same way at `bg-card/40`
  (lighter, since these are mostly whitespace, not text-dense).
- **`StatTile`** (Dashboard + Reports) went from a fully opaque `bg-card` to `bg-card/80
  backdrop-blur-md` — already legible before, but explicitly asked to read as "glass" on these
  two pages rather than a flat block.
- **`CalendarGrid` cells** — a "no record" cell had no background at all (just a border), so the
  date number sat directly on the image with nothing behind it. Every cell (status-colored or
  not) now gets a `bg-card/35 backdrop-blur-sm` base layer, with the existing status gradients
  (warning/success/primary tints) layering on top of it rather than instead of it.
- **A real, measurable contrast bug, not new to this pass but only actually computed now:**
  `text-primary` (`#2b44d1`) used as literal text/icon color measures **~2.2:1** against `--card`
  (`#161f45`) by relative-luminance contrast math — nowhere near WCAG AA's 4.5:1 for text. It
  reads fine as a *fill* (a filled button, a filled badge — white text on it is ~15.9:1), just not
  as foreground color on a dark surface, which is exactly what "wherever blue is used" was
  pointing at. Added `--link: #60a5fa` (same hue family, lightened — ~6.3:1 against `--card`) and
  a `--color-link` Tailwind token from it, then swept every literal `text-primary` (not
  `text-primary-foreground`, not `bg-primary`/`border-primary`) to `text-link` across the app:
  links, active-nav-item text, icon-badge glyphs, the Holiday badge/calendar-cell text.
- **Work Log's task-row "Open" link is now a real `Button` (`variant="outline"`, `asChild`
  wrapping the `<a>`)**, not a bare underlined text link — per explicit request. No `e2e` spec
  asserted on it by text/role, so nothing else needed to change.
- **Verification:** 233 Vitest tests, lint, typecheck, and `next build` all clean; Dashboard,
  Calendar, Reports, and Work Log re-checked visually in the real browser session specifically
  for the fixed spots (table rows, calendar cells, the Open button, link-colored text), not just
  a general look-over.

**Eighth pass — full retheme onto the "Aether" reference + an explicit anti-AI design brief
(user supplied a rewritten `design.md` with two screenshots and a long "ANTI-AI WEBSITE DESIGN
SYSTEM" spec: forbidding gradients / glassmorphism / glow shadows / hover-lift / emoji /
decorative icons / generic card grids, demanding real hierarchy, product-specific copy,
intentional typography).** This threw out the blue/purple/black direction of passes 4–7
entirely.
- **`design.md` is now three concatenated template dumps.** The screenshots correspond to the
  middle one — "Aether": a near-monochrome green system (primary `#B1E09D`, surface `#061C15`,
  accent `#82A89C`, border `#D1DEDC`, ink `#111827`/`#4B5563`), Plus Jakarta Sans display,
  Playfair Display body, JetBrains Mono labels. Two decisions confirmed with the user via
  `AskUserQuestion` before starting: (1) **light canvas** — the Aether palette's own
  `background` role is the light green, and screenshot 2 is light, so `:root` is now the only
  theme and the `.dark` block was deleted (no more `dark` class on `<html>`, no
  `prefers-color-scheme`); (2) **Playfair for display moments only** — page-header titles and
  the work-day date headline get `.font-display` (Playfair italic); everything else, including
  all tables/forms, stays Plus Jakarta Sans, because full serif body copy wrecks readability in
  this app's density. `next/font/google` now loads Plus_Jakarta_Sans / Playfair_Display /
  JetBrains_Mono.
- **`globals.css` rebuilt from scratch.** Palette hexes taken verbatim from design.md where it
  defines a role; roles it doesn't (`--secondary`/`--muted` neutral surfaces) derived to sit at
  the same depth. **Six+ work-day / skill / task states have to stay distinguishable with an
  almost-monochrome palette**, so the greens are used as a deliberate ramp — hairline `outline`
  → sage `accent` → bright green `success` → deepest green `brand-strong` — encoding
  NOT_STARTED → IN_PROGRESS → COMPLETED → HOLIDAY (see `WORK_DAY_STATUS_BADGE_VARIANT`, now
  `outline`/`accent`/`success`/`brand`), and the skill proficiency ramp is grey-green → sage →
  green (`SKILL_CATEGORY_*_CLASS`, de-gradiented). Two off-green signals — muted amber
  (`--warning`) and muted brick (`--destructive`) — are reserved strictly for "needs attention"
  and "delete/invalid"; the anti-AI brief itself calls for real error states, and a delete
  button must not read as "completed". `--link` (`#1f5c43`) is the readable-green foreground for
  text links / colored glyphs (green primary on white fails AA as text). Body backdrop is one
  quiet 340px top-edge gradient — no image (the old `background.jpg` is blue, off-palette, now
  unused), no blobs/mesh. New `.eyebrow` (mono kicker) and `.font-display` utilities; `.dark`
  and `.text-gradient-brand` removed.
- **Primitives de-AI'd.** `Button`: flat fills, **pill shape** (`rounded-full`, matching
  screenshot 2's CTAs), no gradient/glow/`hover:brightness`/`hover:-translate`; new `accent`
  variant = the bright-green secondary CTA. `Badge`: flat fills, added `accent`/`brand`
  variants, dropped `info`. `StatTile`: no glass/`backdrop-blur`/gradient-wash/hover-lift/
  gradient-icon-badge/gradient-bar — now a bordered card with a 2px accent top rule, mono
  `.eyebrow` label, big tabular number, optional `hint`. `PageHeader`: no gradient icon badge,
  no per-page decorative hue (the `accent` prop and its `teal`/`violet`/`cyan` keys are gone
  from every call site) — now a mono eyebrow + Playfair title + description; Dashboard finally
  has a real page title. `Dialog`/`AlertDialog` content → `bg-popover` (crisp white) instead of
  the green-tinted `bg-background`; `Input`/`Textarea` → `bg-card`. `Progress` track → `bg-muted`.
- **Mechanical sweep across ~20 component files** (via `perl -pi`): the shared table wrapper
  `bg-card/85 backdrop-blur-md` → `border-border bg-card`; empty-state boxes `bg-card/40
  backdrop-blur-md p-5` → `bg-card p-6`; section-header icon badges `from-primary/25
  to-accent/25 … bg-gradient-to-br` → `bg-secondary text-link`; the three "hero" cards' `border-l-4
  shadow-primary/5` → `border-l-2 border-l-accent`; `CalendarGrid` cells → flat state fills +
  today ring on `--ring`; calendar legend swatches realigned to the grid's actual state colors;
  every `text-info`/`text-accent`-as-glyph → `text-link`.
- **Navigation moved to a fixed left sidebar** (user request, same message as the settings-500
  fix below). `src/components/layout/header.tsx` now renders a `w-64` vertical `<aside>` (`hidden
  lg:flex`, `fixed inset-y-0 left-0`, `border-r`) — wordmark in a bordered top block, nav items
  stacked with icon + label, Log Out pinned at the bottom behind a `border-t`. Active item = a
  `bg-secondary` chip with an `after:` accent bar flush to the left edge. Below `lg` it's a
  sticky top bar + a `-translate-x-full` slide-in drawer with a fading backdrop (both `lg:hidden`,
  so at the e2e default 1280px viewport they're `display:none` and `getByRole("navigation",
  {name:"Primary"})` still resolves to exactly one). New `src/components/layout/app-shell.tsx`
  (client) owns the frame: it applies `lg:pl-64` to the content wrapper for every route and
  renders a chrome-free full-bleed `<main>` for `/login`. `layout.tsx` renders `<AppShell>` and
  no longer imports `Header` directly. `Sparkles` (a forbidden decorative/"AI" glyph) swapped
  for `GraduationCap` on Skills everywhere it appeared.
- **Subtle motion only** (user asked for "very minor" animation). One `route-fade` keyframe
  (0.22s opacity + 6px rise) applied via a `key={pathname}` wrapper in `AppShell` so page
  content replays it on each client navigation; nav items / drawer / backdrop use plain
  `transition-colors` / `transition-transform`. A `prefers-reduced-motion: reduce` block in
  `globals.css` kills `route-fade` and clamps every transition/animation to ~0.
- **Login** rebuilt as the one deliberate hero moment: white card, deepest-green top rule (flat,
  not gradient), the logo mark, mono eyebrow, Playfair wordmark, full-width primary pill.
- **Custom logo** (user request). `src/components/layout/logo.tsx` — an inline-SVG "bound
  ledger" mark: a spine plus three logged entries of decreasing length, on a `rounded` deepest-
  green tile, glyph in primary green. Colours are theme utilities (`fill-brand-strong` /
  `fill-success`) so it tracks the palette; `aria-hidden` since the wordmark text sits beside
  it. Replaces the generic `lucide` `Timer` in the sidebar, the mobile drawer, and login.
  `src/app/icon.svg` is the same mark with literal hexes (`#061C15` tile / `#B1E09D` glyph) —
  App Router picks it up as the favicon automatically.
- **`BackButton`** (`src/components/layout/back-button.tsx`, user request "a back button
  whenever needed"). Ghost, muted, `ArrowLeft` + "Back"; `router.back()` when
  `window.history.length > 1`, else `router.push(fallbackHref)`. Added only to `/worklog/[date]`
  — the one detail route that isn't a sidebar destination — with `fallbackHref="/calendar"` for
  direct loads. The month page (`/calendar/[month]`) already has Prev/Next and is effectively
  top-level, so it deliberately doesn't get one.
- **`prisma.appSettings` "Cannot read properties of undefined (reading 'upsert')" on `/settings`
  after this pass was the exact stale-client issue CLAUDE.md's "Working Days" note already
  documents** — a long-running `next dev` process from before `npx prisma generate` never
  reloaded the regenerated `src/generated/prisma`. Fix is to restart `next dev` (not a code
  change). If it recurs after any schema/generate step, restart the dev server before suspecting
  anything else.
- **Verification:** typecheck, `npm run lint`, and `npx next build` all clean. Vitest: the full
  run showed 212 passed + 1 worker-pool **startup** timeout on `excel-export.test.ts` under
  concurrent load (dev server + browser running) — re-ran that file standalone, 21/21 pass; the
  same parallel-worker-contention flake documented in Phases 7–10, not a regression (this pass
  changed only classNames, fonts, and colour-map string values — zero logic). Login, Dashboard,
  Skills, Calendar, Work Log, Reports, and the Add Task dialog all spot-checked in a real
  authenticated browser session. `date-fns`-style caveat: the browser tool's viewport scaling
  was flaky this session, so exact responsive/mobile rendering is **not** re-verified — the
  Tailwind breakpoints are unchanged from prior passes.

**Ninth pass — strict palette lockdown + card fills instead of borders (user: "remove colors
like orange, grey and only use colors mentioned in design.md. Rather than adding border to
cards, color that card").** A small, targeted follow-up to the eighth pass, not a retheme:
- **`--warning` (the muted amber) is gone entirely** — token removed from `globals.css` and
  `@theme inline`, `warning` variant removed from `Badge`, `warning` key removed from
  `StatTile`'s accent map. design.md's Aether palette is green-only and defines no
  warning/error hue, so "needs attention" now shares the single reserved off-green signal with
  "invalid/error": `--destructive` (the muted brick). The Task discrepancy banner
  (`task-section.tsx`) and the import "already exists" badge were repointed —
  banner → `border-destructive/40 bg-destructive/10 text-destructive`, badge →
  `variant="outline"` (a skipped duplicate is a hairline, not an error). The two decorative
  `accent="warning"` StatTiles (Dashboard "Avg. task duration", Reports "Total task duration")
  were never warnings — just colour variety — and are now `accent="primary"`.
- **Neutral grey *fills* swept to greens** (design.md's grey `#4B5563` survives only as
  `--muted-foreground` text, which is its `text-secondary` role): `SKILL_CATEGORY_PROGRESS_CLASS`
  LESS_THAN_30 `bg-muted-foreground/45` → `bg-accent/40`; its icon-class equivalent
  `bg-muted` → `bg-secondary`; `StatTile`'s `bg-foreground/20` top rule deleted with the rule
  itself; `CalendarGrid`'s weekend-column `bg-muted/50` → `bg-secondary/60`. The mobile-drawer
  scrim `bg-foreground/20` is a translucent modal overlay, not a UI colour — left as-is.
- **Cards are filled, not bordered.** The `border border-l-2 border-l-accent` decoration on the
  three hero cards (`TodayWorkCard`, `TimeTrackingCard`, `WorkDayHeader`) and the plain
  `border border-border` on `StatTile`, the Export/Settings/Reports-filter form cards, the
  Export/Import info `<aside>`s, the Import upload card, the skill cards, and the 7 dashed
  empty-state boxes were all replaced with a `bg-secondary` (soft-green `#d7e6cf`) fill — a
  panel that reads as distinct from the pale-green page without a hairline. `SkillCard` also
  dropped its per-category left-border (`SKILL_CATEGORY_BORDER_CLASS`, now deleted from
  `skill.ts` — the Progress bar colour + the page's category grouping already encode the band).
  White `bg-card` inputs/tables inside these panels now pop against the green. Data-table
  wrappers keep their `border-border` (green-tinted, and dense data needs an edge) — the
  directive was about cards, not grids.
- **Stale icon imports removed** after the user's own pre-pass edits stripped the icon glyphs:
  `TrendingUp` (Dashboard), `CalendarRange`/`GraduationCap` (Reports), `Briefcase`
  (TodayWorkCard), `Clock` (TimeTrackingCard), `CalendarRange` (WorkDayHeader), plus a second
  round (`CalendarCheck2`/`CheckCircle2`/`Clock`/`ListTodo`/`Timer` on Dashboard, `Zap` on
  ExportQuickLinks, `CalendarRange` on ExportRangeForm) after the user removed the `<h2>`/
  StatTile glyphs. `StatTile` keeps `icon?: LucideIcon` in its prop type (accepted, not
  rendered) so the `icon={…}` call sites in `reports/page.tsx` still typecheck.
- **Then (same message follow-up): "use different colors for different cards … add a little
  shadow, they look bland."** A flat sheet of one `bg-secondary` green was the problem. Cards
  now carry a **soft `shadow-sm`** (`shadow-md` on the three hero cards) and one of a
  small set of design.md-green tints chosen by the card's *purpose*, so sections read as
  distinct:
  - `StatTile` — new `ACCENT_SURFACE` map keyed on the existing `accent` prop: `info` (hours) →
    `bg-accent/15`, `primary` (counts) → `bg-secondary`, `success` (completed) → `bg-success/25`.
  - `SkillCard` — new `SKILL_CATEGORY_SURFACE_CLASS` in `skill.ts` tints the whole card by
    proficiency band (`bg-muted` → `bg-secondary` → `bg-success/25`), which is what actually
    brings back the per-category cue the eighth/ninth pass dropped with the left border.
  - Hero cards: `TodayWorkCard` + `WorkDayHeader` stay `bg-secondary`; `TimeTrackingCard` →
    `bg-accent/15` so the two stacked cards on `/worklog/[date]` don't merge.
  - Forms: `bg-secondary` for the "primary action" ones (ExportQuickLinks, WorkingDaysForm,
    Import upload), `bg-accent/15` for the "filter/refine" ones (ExportRangeForm,
    ReportDateFilterForm); Export/Import info `<aside>`s → the quieter `bg-muted`; the Import
    success panel → `bg-success/25`.
  - Data-table wrappers: kept white `bg-card` + border, added `shadow-sm`.
- **Verification:** `npm run typecheck`, `npm run lint`, `npx next build`, and
  `vitest run src/test/unit` (168 passed) all clean. Not re-checked in a live browser this
  session.

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
  the "Tasks · last 30 days" count is the total regardless of timer status.
- **`/dashboard` is `export const dynamic = "force-dynamic"` — always server-rendered, never a
  build-time static snapshot** (user-reported bug: "Recent Work Days does not work properly in
  the deployed website"; earlier "delete a task and the Dashboard doesn't reflect it; Reports
  does"). Root cause: `/dashboard` had no dynamic input, so `next build` prerendered it
  `○ (Static)` and Vercel served that build-time snapshot until something revalidated the exact
  path. Reports was never affected only because it reads `searchParams` → `ƒ (Dynamic)`. Two
  changes together fixed it: (1) the Dashboard now reads a `?month=` searchParam **and** carries
  `force-dynamic`, so `next build` lists it `ƒ (Dynamic)` and every hit re-queries the DB; (2)
  `revalidateWorkViews(date?)` in `src/lib/actions/revalidate-work-views.ts` revalidates
  `/worklog/${date}` + `/dashboard` + `/calendar/[month]` (page) + `/reports` together, and every
  mutating action in `task-actions.ts` / `workday-actions.ts` (incl. `deleteWorkDayAction`) calls
  it instead of a bare `revalidatePath` (still useful for the client Router Cache and the
  Calendar page). **Any new task/workday mutation must call `revalidateWorkViews`, not
  `revalidatePath` directly.**
- **Dashboard stats use ROLLING windows, not calendar week/month** (changed on user feedback —
  a calendar month reads as empty on the 1st even with a full week of work in the days just
  before it). `getRollingRange(today, 30)` in `src/lib/domain/workday.ts` drives the "· last 30
  days" *task* stats (Tasks / Completed). `getMonthRange` still backs Reports, the calendar
  month page, and the export route. `getWeekRange` was **deleted** — nothing rendered a weekly
  stat any more (user: "remove average and weekly tasks or hours from everywhere").
- **The Dashboard's "Total hours" figure is per calendar month, chosen from a dropdown.**
  `src/components/dashboard/month-hours-panel.tsx` (`MonthHoursPanel`, client) — a `<select>` of
  the last 12 months inside **`next/form`'s `<Form action="/dashboard">`**, auto-submitting on
  `change` (`event.currentTarget.form?.requestSubmit()`); the "Show" button is only a no-JS
  fallback. **Two dead ends that were tried first:** a bare `<form method="GET">` only applies on
  an explicit click, which users don't do (number looked stuck); and
  `router.push("/dashboard?month=X")` does **not** re-run a server component when only the query
  string changes on the same path (documented App Router behavior) — so the first pick worked
  and every later month kept showing the first total ("same for every month"). `next/form` does a
  real client navigation that re-renders the page's server component with the new searchParam
  every time. The page parses `?month=` (`parseMonthOnly`, current month on missing/invalid),
  sums `sumNetWorkSeconds` over that month's `listWorkDays(getMonthRange(...))`, and shows it
  beside the picker (`data-testid="month-total-hours"`). The searchParam is also what makes
  `/dashboard` dynamic — `force-dynamic` (note above) is belt-and-braces + self-documenting.
- **The Dashboard's "Today's hours" tile ticks live for an in-progress day.**
  `src/components/dashboard/live-today-hours.tsx` (`LiveTodayHours`, client) takes the
  server-computed base sum (which counts today's not-yet-checked-out day as 0, via
  `sumNetWorkSeconds`) plus today's `checkIn`/`breakSeconds`, and adds
  `elapsedWorkSeconds(day, getNaiveLocalNow())`, re-rendering once a second. `elapsedWorkSeconds`
  (`domain/workday.ts`) is check-in → now − break; `now` MUST be naive-local so it's on the same
  clock basis as `checkIn` (the "two clocks" rule, §3). An in-progress break isn't subtracted in
  real time (would mix clocks) — the figure over-counts slightly until the break ends, fine for
  an overview. **Removed over successive user requests:** the "Last 7 days" / "Last 30 days"
  *hours* tiles (`sumNetWorkSeconds` only counts days with both a check-in and a check-out, so
  un-checked-out days silently dropped the total far below reality), the Dashboard's "Avg. task
  duration" tile, and Reports' "Avg. daily hours" tile + `WorkSummary.averageDailyHoursSeconds`
  (user: "remove average ... from everywhere"). `LiveTodayHours` renders exactly one tile now;
  the Dashboard Statistics grid is Today's hours + Tasks·30d + Completed·30d.
- **"Projected Check Out" = `checkIn + totalTaskSeconds + breakSeconds`** (user request: "add
  end time according to task duration and break time"). `projectedCheckOutTime(workDay,
  totalTaskSeconds)` in `domain/workday.ts` — a planning aid, never stored. Shown only while a
  day is open (checkIn set, checkOut not) in both `TodayWorkCard` and `TimeTrackingCard` (which
  gained a `totalTaskSeconds` prop, fed from `WorkDayPanels`). `checkIn` is naive-local-encoded,
  so a plain ms offset keeps it on the same clock basis and it formats with `formatClockTime`.
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
- **`Holiday` (reference calendar) vs `WorkDay.dayType` (actual recorded status) are
  different things.** `Holiday` is a small reference table of known dates (e.g. national/
  company holidays) used to auto-suggest status when a date is selected. `WorkDay.dayType`
  (`WORKING | HOLIDAY | LEAVE`) is the actual, editable, submitted status for that day. This
  resolves the spec's apparent overlap between "configured holiday" (§8) and "mark a day as
  holiday" (§13).
- **Excel day-off-row layout is an assumption, still not visually confirmed.** No screenshot
  has ever been provided — only the text description. Post-Phase-11 (see §3 top) a HOLIDAY /
  LEAVE / WEEKLY OFF day renders as Date + Day + one bold merged cell across C..I; earlier
  (Phase 7) it was `"HOLIDAY (reason)"` in the Task List column only — see
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

- **`WorkDay.isHoliday` boolean was replaced by a `dayType` enum
  (`WORKING | HOLIDAY | LEAVE`) + `dayNote` (renamed from `holidayReason`).** User request:
  "a day can be declared leave or holiday", modelled — per an `AskUserQuestion` answer — as a
  single mutually-exclusive "Day type" selector in `WorkDayHeader`, not two toggles. Migrations
  `20260901120000_add_leave_workday_status` (adds `LEAVE` to `WorkDayStatus` — kept as its own
  migration because Postgres won't let a just-added enum value be used in the same transaction)
  and `20260901120100_add_workday_type` (creates the enum, adds `dayType` backfilled from
  `isHoliday`, renames `holidayReason`→`dayNote`, drops `isHoliday`). `deriveWorkDayStatus` now
  takes `dayType` and can return `WorkDayStatus.LEAVE`; `WORK_DAY_STATUS_LABELS` /
  `WORK_DAY_STATUS_BADGE_VARIANT` (badge variant `secondary`) / `CalendarGrid`'s
  `STATUS_STYLES`/`STATUS_ICONS` (Plane icon) / the calendar legend all gained a Leave entry.
  **When `dayType !== "WORKING"` the whole work surface on `/worklog` is frozen** (user
  request): `TimeTrackingCard` hides Start/End Work + break buttons and the "Edit times
  manually" form; `TaskSection` disables "Add Task" and passes `isPending || isDayOff` to
  `TaskTable`, which forwards a new `disabled` prop to `TaskTimerControls` so the per-row
  edit/duplicate/reorder/timer/delete controls are all inert; each spot shows a "marked as
  holiday/leave" note. **`dayType` is lifted into a new client wrapper
  `src/components/workday/work-day-panels.tsx`** that owns it and renders all three cards, so
  picking Holiday/Leave in the header freezes the sibling cards *immediately* (client-side),
  not only after Save revalidates. `WorkDayHeader` took `dayType`/`onDayTypeChange` as props
  (was internal `useState`); the wrapper re-syncs from the server value with the usual
  compare-in-render pattern. The `/worklog/[date]` page now renders `<WorkDayPanels>` instead
  of the three components directly. UI-only — server actions aren't guarded
  (`deriveWorkDayStatus` already pins status to HOLIDAY/LEAVE, and flipping the day type back to
  Working restores everything).
- **"Reset time tracking" (user request).** `resetWorkDayTimes(id)` (`src/lib/data/workday.ts`)
  nulls `checkIn`/`checkOut`/`breakStartedAt` and zeroes `breakSeconds`, re-deriving `status`
  (→ NOT_STARTED, or stays HOLIDAY/LEAVE if the day type forces it); tasks/notes/dayType are
  untouched. `resetWorkDayTimesAction(workDayId, date)` is a `void` action (revalidates
  `/worklog/${date}`). In `TimeTrackingCard` it's a ghost button at the bottom of the "Edit
  times manually" section, shown only when there *is* tracked time (`checkIn || checkOut ||
  breakSeconds > 0 || on break`), behind the standard shadcn `AlertDialog` confirm (never
  `window.confirm`, CLAUDE.md §3). Not offered on a holiday/leave day (that whole section is
  hidden) — switch back to Working to reset.
  **This migration was actually applied to the Neon DB this session** (`prisma migrate deploy`
  reached the direct connection — the P1001 sandbox restriction from Phases 8/9 wasn't in
  effect), so a later Vercel `migrate deploy` will no-op it.
- **Excel export changes (same user request):**
  - A task link now renders as a hyperlink whose **display text is the literal word `link`**
    (`{ text: "link", hyperlink: url }`), not the URL repeated as text.
  - Non-working days now appear in month/range exports. `fillMissingWorkingDays` →
    `fillMissingExportDays` (dropped its `workingDays` param) now back-fills **every** missing
    calendar day up to today, not just configured working days. `buildWorkLogWorkbook` takes
    `workingDays` and decides each row's shape: `HOLIDAY` / `LEAVE` / (weekend, nothing logged)
    `WEEKLY OFF` all render as **Date + Day + one bold, centered cell merged across columns
    C..I** (`addDayOffRow`); everything else is a normal row. `isWeeklyOffExportDay` (new,
    exported from `domain/workday.ts`) is the "empty + not a working day + not declared
    off" test.
  - Every export ends with a bold **TOTAL** row (label in the TaskID column, sum of all task
    durations in the Duration column, formatted `H:MM:SS`). Header row got an autofilter.
  - `parseWorkLogWorkbook` (import) reads the merged label from **column 3** now (not the Task
    List column), maps it to `dayType`, and **skips `WEEKLY OFF` rows** (synthetic, not stored)
    and the trailing `TOTAL` row (no Date). It can't gate day-off detection on "TaskID empty"
    because ExcelJS surfaces a merged range's shared value from every cell in it — it keys
    purely off the column-3 pattern, which is safe since a real row's column 3 is always a
    clock time or blank.

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
NOT_STARTED | IN_PROGRESS | COMPLETED | HOLIDAY | LEAVE), dayType (enum:
WORKING | HOLIDAY | LEAVE, default WORKING), dayNote (nullable — reason/label for a
holiday/leave day, was `holidayReason`), notes (nullable), createdAt, updatedAt`

`dayType` is the user's classification of the day (single mutually-exclusive selector in the
`/worklog` header); `status` is still derived (`deriveWorkDayStatus`) — HOLIDAY/LEAVE dayType
force the matching status, otherwise checkIn/checkOut drive it. Weekends are NOT a `dayType`
— they're derived from `AppSettings.workingDays` at read time (Excel "WEEKLY OFF" rows).

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

### AppSettings (whole-app config singleton, not per-user data)
`id (fixed "singleton"), workingDays (Int[], default [1,2,3,4,5], Sun=0..Sat=6), updatedAt`

One row, always. Read via an `upsert` on the fixed id (`src/lib/data/settings.ts`) so it never
needs a seed step — the default materializes on first read. Drives which dates
`fillMissingWorkingDays` (`src/lib/domain/workday.ts`) synthesizes a blank export row for, so a
month/range export always has one row per expected working day, not just the ones that got a
real `WorkDay` row from being visited.

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
- Task ID is **optional** (user request) — a task can be a free-form note with no ticket ID.
  When present it must still match `^[A-Za-z]+-\d+$` (e.g. `T-1039`), a single regex constant.
  Stored as `""` (not null) when omitted; `TaskTable` shows `—`, aria-labels fall back to
  `"task"`. Excel import treats a row as a task if it has a Task ID *or* a description.
  `Link` was already optional.
- Skill `proficiencyPercentage` clamped to `[0, 100]` at the validation layer (Zod) before it
  ever reaches the database.

## 6. Excel Export Requirements

Exact header row, in this order, always:
`Date | Day | Check In | Check Out | Break | TaskID | Task List | Duration of Task | Links`

- One work day → one visual block. If it has N tasks, Date/Day/Check In/Check Out/Break are
  vertically merged across N rows; TaskID/Task List/Duration of Task/Links vary per row.
- A whole "day off" — declared HOLIDAY, declared LEAVE, or a weekend/non-working day
  (`AppSettings.workingDays`) with nothing logged — renders as Date + Day + **one bold, centered
  cell merged across columns C..I** reading `HOLIDAY` / `LEAVE` / `WEEKLY OFF` (plus
  `(dayNote)` when set). A weekend day that *does* have work logged renders as a normal row.
- Links are real Excel hyperlinks; the **display text is the literal word `link`**
  (`cell.value = { text: "link", hyperlink: url }`), not the URL.
- The sheet ends with a bold **TOTAL** row: `TOTAL` in the TaskID column, the summed task
  duration (`H:MM:SS`) in the Duration column. Header row also carries an autofilter.
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
│   │   ├── settings/page.tsx     # Working Days config (see §3) — Holiday CRUD still not built
│   │   ├── */loading.tsx         # dashboard, worklog/[date], calendar/[month], skills, reports
│   │   └── api/
│   │       ├── export/route.ts
│   │       ├── import/route.ts
│   │       └── health/route.ts
│   ├── components/
│   │   ├── ui/                   # shadcn primitives (+ skeleton.tsx)
│   │   ├── layout/                # header.tsx, page-header.tsx (shared page title/icon block)
│   │   ├── auth/ workday/ task/ skill/ calendar/ dashboard/ settings/
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
