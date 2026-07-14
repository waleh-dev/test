import postgres from 'postgres';

// Bun auto-loads .env, so process.env.DATABASE_URL is available.
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = Number(process.env.PORT ?? 3000);

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Add it to .env (see README).');
  process.exit(1);
}

// Server-side only. The Postgres password never reaches the browser.
const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  max: 1,
  onnotice: () => {},
});

// Create the table once on boot (idempotent). Don't hard-crash if the
// database is momentarily unreachable — keep serving the form.
try {
  await sql`
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
  console.log('✅ Connected to Supabase Postgres; table "appraisals" ready.');
} catch (err) {
  console.error('⚠ Could not reach Supabase / create table on boot:', String(err));
  console.error('   The form will still be served, but submissions will fail until the DB is reachable.');
}

const FORM_PATH = 'src/teacher-appraisal-form.html';

function parseNum(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const n = Number(v.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // ---- API: receive a submitted appraisal ----
    if (req.method === 'POST' && url.pathname === '/api/submit') {
      try {
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
        return Response.json({ status: 'ok', message: 'Appraisal saved to Supabase.' });
      } catch (err) {
        console.error('Insert failed:', err);
        return Response.json(
          { status: 'error', message: 'Could not save appraisal. Check server logs.' },
          { status: 500 }
        );
      }
    }

    // ---- Static form ----
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const file = Bun.file(FORM_PATH);
      if (await file.exists()) {
        return new Response(file, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return new Response('Form not found. Expected ' + FORM_PATH, { status: 404 });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`🚀 Teacher Appraisal server running at http://localhost:${PORT}`);
