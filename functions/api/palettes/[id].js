import { getPalette } from '../../../lib/palettes.js';

// GET /api/palettes/:id - віддати палітру.
export const onRequestGet = ({ params, env }) => getPalette(params.id, env.DB);
