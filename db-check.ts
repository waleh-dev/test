import postgres from 'postgres';
import dns from 'node:dns/promises';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ DATABASE_URL is empty. Set it in .env.');
  process.exit(1);
}

// Parse host/port from the URL (without leaking the password).
let host = '', port = '', user = '', db = '', hasAt = false;
try {
  const u = new URL(url);
  host = u.hostname;
  port = u.port || '5432';
  user = u.username;
  db = u.pathname.replace(/^\//, '');
  hasAt = url.includes('@');
} catch {
  console.error('❌ DATABASE_URL is not a valid URL.');
  process.exit(1);
}

console.log('── Postgres connection diagnostic ─────────────────');
console.log('  user :', user || '(none)');
console.log('  host :', host);
console.log('  port :', port);
console.log('  db   :', db || '(default)');
console.log('  has @ :', hasAt, '(password @ must be URL-encoded as %40)');
console.log('────────────────────────────────────────────────────');

// 1) Is the hostname even resolvable? (isolates DNS vs auth/ssl)
console.log('\n[1] DNS lookup for', host, '...');
try {
  const addrs = await dns.lookup(host, { all: true });
  console.log('    ✅ resolved:', addrs.map(a => a.address).join(', '));
} catch (e) {
  console.error('    ❌ DNS FAILED:', e.code, '-', e.message);
  console.error('       -> The host cannot be resolved from this machine/network.');
  console.error('       -> Check: internet access, VPN, corporate firewall, or a typo in the project ref.');
  process.exit(2);
}

// 2) Try a real connection + trivial query.
console.log('\n[2] Connecting to Postgres (SSL required) ...');
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 });
try {
  const r = await sql`SELECT 1 AS ok`;
  console.log('    ✅ Connected. SELECT 1 ->', r[0]);

  // 3) Confirm the target table exists / can be created.
  console.log('\n[3] Ensuring "appraisals" table ...');
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
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'appraisals' ORDER BY ordinal_position`;
  console.log('    ✅ Table ready. Columns:', cols.map(c => c.column_name).join(', '));

  // 4) Optional round-trip insert + delete to prove read/write works.
  console.log('\n[4] Read/write round-trip test ...');
  const ins = await sql`
    INSERT INTO appraisals (teacher_name, staff_id, total_score, grade, payload)
    VALUES ('__diagnostic__', 'DIAG', 99.9, 'A', ${sql.json({ ok: true })})
    RETURNING id
  `;
  await sql`DELETE FROM appraisals WHERE id = ${ins[0].id}`;
  console.log('    ✅ Insert + delete succeeded (id', ins[0].id, '). DB is fully reachable & writable.');

  console.log('\n🟢 ALL CHECKS PASSED. The Bun server will work.');
} catch (e) {
  console.error('    ❌ Connection/query failed:', e.message);
  if (String(e.message).includes('password')) console.error('       -> Password likely wrong or @ not encoded as %40.');
  if (String(e.message).includes('SSL') || String(e.message).includes('ssl'))
    console.error('       -> SSL issue; Postgres requires ssl (handled in server.ts).');
  if (String(e.message).includes('does not exist') || String(e.message).includes('permission'))
    console.error('       -> Database/role issue; check the DB name and that "postgres" role exists.');
} finally {
  await sql.end({ timeout: 5 });
}
