import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID_PATTERN, newId, createPalette, getPalette } from '../lib/palettes.js';

// Мінімальна фейкова D1: тільки три запити, які робить lib/palettes.js.
function fakeDb() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith('SELECT id FROM palettes WHERE hex')) {
                const r = rows.find((x) => x.hex === args[0]);
                return r ? { id: r.id } : null;
              }
              if (sql.startsWith('SELECT id, hex, created_at')) {
                return rows.find((x) => x.id === args[0]) ?? null;
              }
              throw new Error(`unexpected sql: ${sql}`);
            },
            async run() {
              const [id, hex] = args;
              if (rows.some((x) => x.id === id)) throw new Error('UNIQUE constraint failed: palettes.id');
              if (rows.some((x) => x.hex === hex)) throw new Error('UNIQUE constraint failed: palettes.hex');
              rows.push({ id, hex, created_at: '2026-10-16 12:00:00' });
              return { success: true };
            },
          };
        },
      };
    },
  };
}

const post = (body) =>
  new Request('http://localhost:8788/api/palettes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('newId: 6 символів [a-z0-9]', () => {
  for (let i = 0; i < 200; i++) assert.match(newId(), ID_PATTERN);
});

test('POST: валідний hex нормалізується, повертає id і url', async () => {
  const db = fakeDb();
  const res = await createPalette(post({ hex: '4F46E5' }), db);
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.match(data.id, ID_PATTERN);
  assert.equal(data.hex, '#4f46e5');
  assert.equal(data.url, `http://localhost:8788/p/${data.id}`);
  assert.equal(db.rows[0].hex, '#4f46e5');
});

test('POST: той самий колір повертає той самий id без нового рядка', async () => {
  const db = fakeDb();
  const a = await (await createPalette(post({ hex: '#facc15' }), db)).json();
  const res = await createPalette(post({ hex: '#FACC15' }), db);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).id, a.id);
  assert.equal(db.rows.length, 1);
});

test('POST: невалідний hex -> 400', async () => {
  for (const hex of ['zzz', '#12', '#1234567', '', null, 123, '<script>']) {
    const res = await createPalette(post({ hex }), fakeDb());
    assert.equal(res.status, 400, String(hex));
    assert.match((await res.json()).error, /hex/);
  }
});

test('POST: некоректний JSON і завеликий запит', async () => {
  assert.equal((await createPalette(post('{oops'), fakeDb())).status, 400);
  assert.equal((await createPalette(post({ hex: '#fff', pad: 'x'.repeat(2000) }), fakeDb())).status, 413);
});

test('GET: збережена палітра і 404', async () => {
  const db = fakeDb();
  const { id } = await (await createPalette(post({ hex: '#0f766e' }), db)).json();
  const res = await getPalette(id, db);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id, hex: '#0f766e', created_at: '2026-10-16 12:00:00' });
  assert.equal((await getPalette('nope00', db)).status, 404);
  assert.equal((await getPalette('../etc', db)).status, 404);
  assert.equal((await getPalette('ABC123', db)).status, 404);
});
