# Teacher Appraisal System

A teacher performance appraisal tool: a **static HTML form** served by a small **Bun server**, with all submissions stored in **Postgres** (configured here for **Render PostgreSQL**, but any Postgres works).

## Architecture

The same request-handling code (`server.ts`) runs in **two modes**:

```
 browser (form)  ──POST /api/submit──▶  Bun server (server.ts)  ──▶  Postgres
         ▲                                            (reads DATABASE_URL, server-side only)
         └────────────── serves public/index.html ────────────┘
                                  — OR, on Vercel —
 browser (form)  ──POST /api/submit──▶  api/submit.ts (Vercel fn → handleSubmit)  ──▶  Postgres
         ▲                                            Vercel serves public/ as static site
         └────────────────────────────────────────────────────────────────────┘
```

The Postgres connection string (with the DB password) lives **only** in `.env`
(local) or Vercel/Render environment variables — never in the browser. A browser
cannot speak the Postgres wire protocol, so a server function is the safe bridge.

## Files

```
public/
  index.html                   The form (23 weighted criteria + auto-computed score)
server.ts                      Bun server + shared handler (handleSubmit / static)
api/submit.ts                  Vercel serverless function → reuses handleSubmit
.env                           DATABASE_URL (gitignored — never commit)
appraisal.test.js              happy-dom integration tests for the form
e2e-test.ts                    boots server, POSTs, verifies DB round-trip
db-check.ts                    connectivity / table diagnostic
tsconfig.json                  Type-checking (bun-types)
```

## Setup

```bash
bun install                 # install postgres + bun-types
# edit .env and set DATABASE_URL to your Postgres connection string, e.g. (Render):
#   postgresql://yeshua:PASSWORD@dpg-xxxx.oregon-postgres.render.com:5432/yeshua
# If the password contains '@', URL-encode it as %40.
```

The server creates the `appraisals` table automatically on first use
(`CREATE TABLE IF NOT EXISTS`).

## Run locally

```bash
bun run dev        # hot-reload server on http://localhost:3000
# or
bun run start      # single run
```

Open <http://localhost:3000>, fill the form, and click **Save to Database**.
Rows land in the `appraisals` table (`teacher_name`, `staff_id`, `total_score`,
`grade`, and a `payload jsonb` with the full record).

## Deploy to Vercel

1. Push this repo to GitHub/GitLab.
2. In Vercel, **Import** the project (no framework — it's static `public/` + one
   serverless function). Vercel auto-detects `public/` (served at `/`) and the
   `api/submit.ts` function (served at `/api/submit`).
3. Add one **Environment Variable**:
   - `DATABASE_URL` = your Postgres connection string, e.g.
     `postgresql://yeshua:PASSWORD@dpg-xxxx.oregon-postgres.render.com:5432/yeshua`
     (URL-encode `@` in the password as `%40`).
4. Deploy. `api/submit.ts` uses the **Node.js** runtime (the `postgres` driver
   needs Node's tls/crypto), which is set via `export const config` in the file.

The form posts to `/api/submit` (same-origin), so it works unchanged on Vercel.

## Deploy to Render (alternative)

The same `server.ts` also runs as a long-lived server on Render: set
`DATABASE_URL` and use `bun run start` as the start command (port from
`$PORT`).

## Verify the database

```bash
bun run db-check.ts   # step [1] DNS, [2] connect, [3] table, [4] read/write
```

## Type-check / test

```bash
bun run typecheck
bun run test          # happy-dom form tests (grade-based comments)
bun run e2e-test.ts  # boots server → POST → verifies DB round-trip (then cleans up)
```

## Security & ops notes

- **Never** commit `.env` or expose `DATABASE_URL` to the client.
- Rotate the DB password if it was ever shared outside a trusted channel.
- Render free-tier databases **expire** (this one on 2026-08-13) — upgrade or
  migrate before then for production use.
- For production, run the server behind auth / a VPN and consider an API key
  check on `/api/submit`.
