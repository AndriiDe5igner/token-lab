// Серверна логіка «Поділитися». Маршрути в functions/ тільки викликають ці функції,
// тож логіку можна тестувати з фейковою D1 (tests/palettes.test.js).

import { normalizeHex } from '../public/color.js';

export const ID_PATTERN = /^[a-z0-9]{6}$/;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 6;
const MAX_BODY_BYTES = 1024;
const INSERT_ATTEMPTS = 5;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/** Випадковий id з 6 символів [a-z0-9]. */
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  // 252 = 36 * 7: відкидаємо байти вище, щоб символи були рівноймовірні.
  let id = '';
  for (const b of bytes) {
    if (b < 252) id += ID_ALPHABET[b % ID_ALPHABET.length];
  }
  return id.length === ID_LENGTH ? id : newId();
}

const findByHex = (db, hex) => db.prepare('SELECT id FROM palettes WHERE hex = ?').bind(hex).first();

/** POST /api/palettes  { hex } -> 201 { id, hex, url } (або 200, якщо такий колір уже є). */
export async function createPalette(request, db) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'Занадто великий запит' }, 413);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Некоректний JSON' }, 400);
  }

  const hex = normalizeHex(body?.hex);
  if (!hex) return json({ error: 'Невалідний hex. Потрібно #RGB або #RRGGBB.' }, 400);

  const urlFor = (id) => new URL(`/p/${id}`, request.url).href;

  const existing = await findByHex(db, hex);
  if (existing) return json({ id: existing.id, hex, url: urlFor(existing.id) }, 200);

  for (let attempt = 0; attempt < INSERT_ATTEMPTS; attempt++) {
    const id = newId();
    try {
      await db.prepare('INSERT INTO palettes (id, hex) VALUES (?, ?)').bind(id, hex).run();
      return json({ id, hex, url: urlFor(id) }, 201);
    } catch (err) {
      // Паралельний запит уже зберіг цей колір - віддаємо його id.
      if (String(err?.message).includes('palettes.hex')) {
        const row = await findByHex(db, hex);
        if (row) return json({ id: row.id, hex, url: urlFor(row.id) }, 200);
      }
      // Колізія id - пробуємо інший. Інша помилка - теж повтор, а потім 500.
    }
  }
  return json({ error: 'Не вдалося зберегти палітру' }, 500);
}

/** GET /api/palettes/:id -> 200 { id, hex, created_at } або 404. */
export async function getPalette(id, db) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return json({ error: 'Палітру не знайдено' }, 404);
  const row = await db.prepare('SELECT id, hex, created_at FROM palettes WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Палітру не знайдено' }, 404);
  // Збережена палітра не змінюється.
  return json(row, 200, { 'Cache-Control': 'public, max-age=3600' });
}
