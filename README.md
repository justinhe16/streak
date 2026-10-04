# streak

A personal, local-first tracker for weekly habit goals, the OKRs they roll up
into, side projects ("builds"), and the occasional reflection. It's a sibling of
research-log: same stack, same look, same palettes.

Everything lives in one SQLite file on your machine. No account, no server, no
network calls.

## Quickstart

```bash
npm install
npm run dev                  # http://localhost:3001
```

The database is created at `./data/streak.db` on first boot, and the migrations
in `./drizzle` are applied automatically. Set `DATABASE_PATH` to put it
somewhere else. The dev server uses port 3001 so it can run alongside
research-log on 3000.

## Architecture

| Piece | What it is |
| --- | --- |
| App | Next.js 16, App Router, TypeScript, Tailwind + shadcn/ui |
| API | Route handlers under `src/app/api/*`, all `runtime = "nodejs"` |
| Storage | SQLite via better-sqlite3 + Drizzle ORM, WAL mode |
| Scoring | Pure functions in `src/lib/streak.ts`, run on the client so check-ins update the grid instantly |

## Layout

Streak is a single page. A floating rail toggles four columns on and off, and
open columns sit side by side in a fixed order: **Builds, Reflections, Goals,
Grid**. Keys `1`–`4` toggle them too. Which columns are open is remembered in a
cookie, so the page renders the same layout on reload.

- **Builds**: side projects, grouped by status (idea, active, paused, done,
  cancelled). A build can optionally link to one OKR. The link doesn't affect
  scoring.
- **Reflections**: occasional Markdown write-ups, each dated. A day with a
  reflection gets a dot on the grid.
- **Goals**: your OKRs, each with a status you set by hand (active / success /
  missed), checkable milestones, and the weekly goals that belong to it. Click
  an OKR to open its detail view, which also lists linked builds. Goals that
  aren't linked to an OKR are listed below.
- **Grid**: one row per Monday–Sunday week, padded with empty weeks on both
  sides. Each day shows how many goals you checked off that day. Each row is
  tinted red → yellow → green by that week's score. Click a past day to check
  off its goals.

## Scoring rules

- A goal asks for `daysPerWeek` check-ins a week. In a week the goal only partly
  covers (it starts or ends mid-week), the target is prorated:
  `ceil(daysPerWeek × activeDays / 7)`.
- Each goal earns partial credit, `min(done / target, 1)`. A week's score is the
  average credit across its active goals. A week with no active goals is gray.
- While the current week is still running, only goals whose outcome is already
  settled count toward the score:
  - A goal you've already met counts as 1.
  - A goal you can no longer meet counts as its best achievable credit.
  - Every other goal is left out.

  The current week's row has a dashed border to show it can still change.
- A goal's frequency and dates are fixed once it's created. Deleting a goal
  removes its check-ins too, and every past week is rescored without it.

## Data

- **Settings → Export** downloads everything as JSON.
- **Import** merges a backup in, skipping ids that already exist.
- **Restore** wipes all current data, then loads the backup.
- `npm run db:backup` saves an online snapshot of the SQLite file to
  `./backups/` and keeps the newest 10.

## API security

This is the same setup as research-log. `src/proxy.ts` rejects mutating
`/api/**` requests that come from another origin. JSON endpoints require
`Content-Type: application/json`. Keep the server bound to localhost.

## Tests

```bash
npm test     # scoring rules, backup round-trip, same-origin guard
npm run lint
```
