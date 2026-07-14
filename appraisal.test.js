import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';

const html = readFileSync('public/index.html', 'utf8');
const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/i);
let bodyHtml = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '');

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const mainScript = scripts.find(s => s.includes('function calculateAll'));
const win = new Window({ url: 'http://localhost/' });
const doc = win.document;
doc.body.innerHTML = bodyHtml;
globalThis.document = doc;
globalThis.window = win;
const api = (new Function('document','window', mainScript + '\n; return { calculateAll };'))(doc, win);

function setRadios(prefix, count, val) {
  for (let i = 1; i <= count; i++)
    for (const r of doc.getElementsByName(prefix + i))
      if (parseInt(r.value) === val) r.checked = true;
}
const setV = (id, v) => { doc.getElementById(id).value = String(v); };
const txt = id => doc.getElementById(id).value;
const trim = s => s.replace(/\s+/g,' ').trim();

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  PASS  ' + name); pass++; }
  catch (e) { console.error('  FAIL  ' + name + ': ' + e.message); fail++; } };

// Grade A scenario: all 5s + strong exam
t('Grade A -> comments filled', () => {
  setRadios('a',7,5); setRadios('b',8,5); setRadios('c',8,5);
  setV('candTotal',100); setV('candPass',90); setV('candA',30); setV('candB',40); setV('prevYear',70);
  api.calculateAll();
  const grade = doc.getElementById('finalDecision').textContent;
  if (!grade.includes('Grade A')) throw new Error('expected Grade A, got: ' + grade);
  for (const id of ['strengths','improvements','goals','teacherResponse']) {
    if (!txt(id).trim()) throw new Error('empty ' + id + ' for grade A');
  }
  console.log('     A strengths: ' + trim(txt('strengths')).slice(0,60) + '...');
});

// Grade B scenario: mostly 4s
t('Grade B -> comments filled', () => {
  const w = new Window({ url:'http://localhost/' }); const d = w.document; d.body.innerHTML = bodyHtml;
  globalThis.document = d; globalThis.window = w;
  const a = (new Function('document','window', mainScript + '\n; return { calculateAll };'))(d, w);
  for (const p of ['a','b','c']) for (let i=1;i<=(p==='a'?7:8);i++) for (const r of d.getElementsByName(p+i)) if (parseInt(r.value)===4) r.checked=true;
  d.getElementById('candTotal').value='100'; d.getElementById('candPass').value='70';
  d.getElementById('candA').value='15'; d.getElementById('candB').value='25'; d.getElementById('prevYear').value='65';
  a.calculateAll();
  const grade = d.getElementById('finalDecision').textContent;
  if (!grade.includes('Grade B')) throw new Error('expected Grade B, got: ' + grade);
  for (const id of ['strengths','improvements','goals','teacherResponse'])
    if (!d.getElementById(id).value.trim()) throw new Error('empty ' + id + ' for grade B');
  console.log('     B goals: ' + trim(d.getElementById('goals').value).slice(0,50) + '...');
});

// Grade D scenario: mostly 2s
t('Grade D -> comments filled', () => {
  const w = new Window({ url:'http://localhost/' }); const d = w.document; d.body.innerHTML = bodyHtml;
  globalThis.document = d; globalThis.window = w;
  const a = (new Function('document','window', mainScript + '\n; return { calculateAll };'))(d, w);
  for (const p of ['a','b','c']) for (let i=1;i<=(p==='a'?7:8);i++) for (const r of d.getElementsByName(p+i)) if (parseInt(r.value)===3) r.checked=true;
  d.getElementById('candTotal').value='100'; d.getElementById('candPass').value='30';
  d.getElementById('candA').value='2'; d.getElementById('candB').value='5'; d.getElementById('prevYear').value='55';
  a.calculateAll();
  const grade = d.getElementById('finalDecision').textContent;
  if (!grade.includes('Grade D')) throw new Error('expected Grade D, got: ' + grade);
  for (const id of ['strengths','improvements','goals','teacherResponse'])
    if (!d.getElementById(id).value.trim()) throw new Error('empty ' + id + ' for grade D');
  console.log('     D response: ' + trim(d.getElementById('teacherResponse').value).slice(0,50) + '...');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
