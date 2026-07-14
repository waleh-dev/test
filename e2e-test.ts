// End-to-end test: boots the real server, POSTs a submission, verifies it
// landed in Render Postgres, then cleans up the test row.
import './server.ts'; // side-effect: starts Bun.serve on :3000

await new Promise((r) => setTimeout(r, 1500));

const payload = {
  teacherName: 'Test Teacher',
  staffId: 'TCH/2024/014',
  totalScore: '95.9 /100',
  grade: 'A',
  a1: '5', b1: '4', c1: '5',
  candTotal: '100', candPass: '85',
};

const res = await fetch('http://localhost:3000/api/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log('SUBMIT RESPONSE:', JSON.stringify(await res.json()));

import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });
const rows = await sql`SELECT teacher_name, total_score, grade
                       FROM appraisals WHERE teacher_name = 'Test Teacher'
                       ORDER BY id DESC LIMIT 1`;
console.log('DB ROW:', JSON.stringify(rows[0]));
await sql`DELETE FROM appraisals WHERE teacher_name = 'Test Teacher'`;
console.log('TEST ROW DELETED (cleanup)');
await sql.end({ timeout: 5 });
process.exit(0);
