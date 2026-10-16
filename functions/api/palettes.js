import { createPalette, json } from '../../lib/palettes.js';

// POST /api/palettes - зберегти палітру, повертає { id, hex, url }.
export const onRequestPost = ({ request, env }) => createPalette(request, env.DB);

// Інші методи не провалюються в статику.
export const onRequest = () => json({ error: 'Метод не підтримується' }, 405, { Allow: 'POST' });
