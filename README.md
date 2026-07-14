# Teacher Appraisal System

A teacher performance appraisal tool: a **static HTML form** served by a small **Bun server**, with all submissions stored in **Supabase Postgres**.

## Architecture

```
browser (form)  ──POST /api/submit──▶  Bun server (server.ts)  ──▶  Supabase Postgres
        ▲                                            (reads DATABASE_URL from .env, server-side only)
        └────────────── serves the form HTML ─────────────┘
```

The Postgres connection string (with the DB password) lives **only** in `.env`,
which is gitignored and never shipped to the browser. A browser cannot speak the
Postgres wire protocol, so a tiny server is used as the safe bridge.

## Files

```
src/
  teacher-appraisal-form.html   The form (23 weighted criteria + auto-computed score)
server.ts                       Bun server: serves the form + POST /api/submit -> Supabase
.env                            DATABASE_URL (gitignored — never commit)
appraisal.test.js                happy-dom integration tests for the form
tsconfig.json                   Type-checking (bun-types)
```

## Setup

```bash
bun install                 # install postgres + bun-types
cp .env.example .env        # or just edit .env
# set DATABASE_URL in .env to your Supabase direct connection string,
# with the password's '@' URL-encoded as %40, e.g.:
#   postgresql://postgres:YOURPASS%4012@db.xxxx.supabase.co:5432/postgres
```

The server creates the `appraisals` table automatically on boot
(`CREATE TABLE IF NOT EXISTS`).

## Run

```bash
bun run dev        # hot-reload server on http://localhost:3000
# or
bun run start      # single run
```

Open <http://localhost:3000>, fill the form, and click **Submit to Supabase**.
Rows land in the `appraisals` table (`teacher_name`, `staff_id`, `total_score`,
`grade`, and a `payload jsonb` with the full record).

## Type-check / test

```bash
bun run typecheck
bun run test
```

## Security notes

- **Never** commit `.env` or expose `DATABASE_URL` to the client.
- Rotate the Supabase DB password if it was ever shared outside a trusted channel.
- For production, run the server behind auth / a VPN and consider adding an
  API key check on `/api/submit`.
"# teach-appraisal" 
"# test" 
