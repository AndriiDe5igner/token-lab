// /p/:id - віддає index.html, клієнт сам підтягує палітру через /api/palettes/:id.
export const onRequestGet = ({ request, env }) => env.ASSETS.fetch(new URL('/', request.url));
