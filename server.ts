import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');

const DATABASE_URL = process.env.DATABASE_URL;

function requiredEnv() {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Add it to .env (local) or to Vercel/Render Environment Variables (prod).'
    );
  }
}

// Lazy, shared Postgres client — one per local server / per serverless
// invocation. The password never leaves the server.
let _sql: ReturnType<typeof postgres> | null = null;
let _ready: Promise<void> | null = null;

function getSql() {
  if (!_sql) {
    requiredEnv();
    _sql = postgres(DATABASE_URL!, {
      ssl: { rejectUnauthorized: false }, // Postgres requires SSL
      max: 1,
      onnotice: () => {},
    });
  }
  return _sql;
}

// Create the table on first use (idempotent). Cached so it only runs once;
// retries on failure so a transient DB outage self-heals.
async function ready() {
  if (!_ready) {
    _ready = (async () => {
      await getSql()`
        CREATE TABLE IF NOT EXISTS appraisals (
          id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          created_at   timestamptz NOT NULL DEFAULT now(),
          teacher_name text,
          staff_id     text,
          total_score  numeric,
          grade        text,
          payload      jsonb NOT NULL
        )
      `;
    })().catch((err) => {
      _ready = null;
      throw err;
    });
  }
  return _ready;
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const m = String(v).match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

// ---- API: receive a submitted appraisal ----
export async function handleSubmit(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  try {
    await ready();
    const sql = getSql();
    const data = (await req.json()) as Record<string, any>;
    await sql`
      INSERT INTO appraisals (teacher_name, staff_id, total_score, grade, payload)
      VALUES (
        ${String(data.teacherName ?? '')},
        ${String(data.staffId ?? '')},
        ${parseNum(data.totalScore)},
        ${String(data.grade ?? '')},
        ${sql.json(data)}
      )
    `;
    return Response.json({ status: 'ok', message: 'Appraisal saved to Postgres.' });
  } catch (err) {
    console.error('Insert failed:', err);
    return Response.json(
      { status: 'error', message: 'Could not save appraisal. Check server logs.' },
      { status: 500 }
    );
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

// Serve files from public/ (local dev / Render). On Vercel the platform
// serves public/ itself, so api/submit.ts only ever calls handleSubmit.
async function serveStatic(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const safe = pathname.replace(/^(\.\.[/\\])+/, '');
  const filePath = join(PUBLIC_DIR, safe);
  try {
    if (typeof Bun !== 'undefined') {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const ext = extname(filePath).toLowerCase();
        return new Response(file, { headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream' } });
      }
    } else {
      const { readFile } = await import('node:fs/promises');
      const buf = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      return new Response(buf, { headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream' } });
    }
  } catch {}
  return new Response('Not found', { status: 404 });
}

export const handler = {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/submit') return handleSubmit(req);
    if (req.method === 'GET') return serveStatic(req);
    return new Response('Not found', { status: 404 });
  },
};

export default handler;

// ---- Local development / Render: start a real Bun server ----
// (On Vercel this block is skipped and api/submit.ts handles requests.)
if (typeof Bun !== 'undefined' && !process.env.VERCEL) {
  const PORT = Number(process.env.PORT ?? 3000);

  ready()
    .then(() => console.log('✅ Connected to Postgres; table "appraisals" ready.'))
    .catch((err) => {
      console.error('⚠ Could not reach Postgres / create table on boot:', String(err));
      console.error('   The form will still be served, but submissions will fail until the DB is reachable.');
    });

  Bun.serve({
    port: PORT,
    fetch: handler.fetch,
  });

  console.log(`🚀 Teacher Appraisal server running at http://localhost:${PORT}`);
}
