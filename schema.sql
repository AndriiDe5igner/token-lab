-- Збережені палітри. Палітра повністю виводиться з hex, тому зберігаємо тільки його.
CREATE TABLE IF NOT EXISTS palettes (
  id TEXT PRIMARY KEY,                              -- короткий id для /p/:id, 6 символів [a-z0-9]
  hex TEXT NOT NULL,                                -- нормалізований '#rrggbb'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Той самий колір повертає той самий id, без дублікатів.
CREATE UNIQUE INDEX IF NOT EXISTS palettes_hex ON palettes (hex);
