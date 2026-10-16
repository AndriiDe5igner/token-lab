// Семантичні токени і експорт.
// Математика кольору - у color.js, тут тільки мапінг шкал на токени.

import { STEPS, brandScale, neutralScale, normalizeHex, contrastRatio, contrastLevel, pickReadable } from './color.js';

export const TOKEN_NAMES = [
  'bg',
  'surface',
  'text',
  'text-muted',
  'border',
  'accent',
  'accent-hover',
  'on-accent',
  'danger',
  'success',
];

// Фіксовані примітиви, не залежать від бренду.
const FIXED = {
  white: '#ffffff',
  'danger-600': '#dc2626',
  'danger-400': '#ff7a6d',
  'success-700': '#006a2e',
  'success-400': '#5bb572',
};

// Найсвітліший крок, який іде в accent темної теми. Світліший бренд лишається як є.
const DARK_ACCENT_STEP = 400;

// Пари для перевірки контрасту. min - поріг WCAG: 4.5 для тексту, 3 для UI-елементів.
export const CONTRAST_PAIRS = [
  { label: 'Текст на фоні', fg: 'text', bg: 'bg', min: 4.5 },
  { label: 'Другорядний текст', fg: 'text-muted', bg: 'bg', min: 4.5 },
  { label: 'Текст у картці', fg: 'text', bg: 'surface', min: 4.5 },
  { label: 'Підпис кнопки', fg: 'on-accent', bg: 'accent', min: 4.5 },
  { label: 'Кнопка на фоні', fg: 'accent', bg: 'bg', min: 3 },
  { label: 'Помилка', fg: 'danger', bg: 'surface', min: 4.5 },
  { label: 'Успіх', fg: 'success', bg: 'surface', min: 4.5 },
];

const stepAt = (i) => STEPS[Math.min(STEPS.length - 1, Math.max(0, i))];

/**
 * Повна палітра від hex: шкали + токени світлої і темної теми.
 * Токен: { ref: 'neutral-50', hex: '#f6f7f8' }.
 */
export function buildPalette(input) {
  const hex = normalizeHex(input);
  if (!hex) throw new TypeError(`Невалідний hex: ${String(input)}`);

  const { scale: brand, anchor } = brandScale(hex);
  const neutral = neutralScale(hex);
  const primitives = { ...FIXED };
  for (const s of STEPS) {
    primitives[`brand-${s}`] = brand[s];
    primitives[`neutral-${s}`] = neutral[s];
  }
  const tok = (ref) => ({ ref, hex: primitives[ref] });

  const ai = STEPS.indexOf(anchor);
  const last = STEPS.length - 1;

  // Світла: accent - сам бренд, hover на крок темніший (для 950 - світліший).
  const lightAccent = anchor;
  const lightHover = stepAt(ai === last ? ai - 1 : ai + 1);

  // Темна: бренд, але не темніший за DARK_ACCENT_STEP; hover на крок світліший.
  const di = Math.min(ai, STEPS.indexOf(DARK_ACCENT_STEP));
  const darkAccent = STEPS[di];
  const darkHover = stepAt(di === 0 ? 1 : di - 1);

  // text-muted: перший крок, що дає 4.5:1 на bg. Для більшості кольорів це 600 / 400,
  // але на межі (напр. бірюза) треба на крок контрастніше.
  const firstReadable = (steps, bgRef) =>
    steps.find((s) => contrastRatio(neutral[s], primitives[bgRef]) >= 4.5) ?? steps[steps.length - 1];
  const lightMuted = firstReadable([600, 700], 'neutral-50');
  const darkMuted = firstReadable([400, 300], 'neutral-950');

  const onAccent = (accentRef) => {
    const best = pickReadable(primitives[accentRef], [FIXED.white, neutral[950]]);
    return best === FIXED.white ? 'white' : 'neutral-950';
  };

  const light = {
    bg: tok('neutral-50'),
    surface: tok('white'),
    text: tok('neutral-950'),
    'text-muted': tok(`neutral-${lightMuted}`),
    border: tok('neutral-200'),
    accent: tok(`brand-${lightAccent}`),
    'accent-hover': tok(`brand-${lightHover}`),
    'on-accent': tok(onAccent(`brand-${lightAccent}`)),
    danger: tok('danger-600'),
    success: tok('success-700'),
  };

  const dark = {
    bg: tok('neutral-950'),
    surface: tok('neutral-900'),
    text: tok('neutral-50'),
    'text-muted': tok(`neutral-${darkMuted}`),
    border: tok('neutral-800'),
    accent: tok(`brand-${darkAccent}`),
    'accent-hover': tok(`brand-${darkHover}`),
    'on-accent': tok(onAccent(`brand-${darkAccent}`)),
    danger: tok('danger-400'),
    success: tok('success-400'),
  };

  return { input: hex, anchor, brand, neutral, themes: { light, dark } };
}

/** Контраст пари токенів теми: { ratio, level, pass }. */
export function pairContrast(theme, fg, bg, min = 4.5) {
  const ratio = contrastRatio(theme[fg].hex, theme[bg].hex);
  return { ratio, level: contrastLevel(ratio), pass: ratio >= min };
}

/** Усі пари CONTRAST_PAIRS для теми. */
export function contrastReport(theme) {
  return CONTRAST_PAIRS.map((p) => ({ ...p, ...pairContrast(theme, p.fg, p.bg, p.min) }));
}

// ---------- експорт ----------

const cssValue = (token) => (token.ref.startsWith('brand-') || token.ref.startsWith('neutral-') ? `var(--${token.ref})` : token.hex);

/** CSS variables: примітиви + світла тема в :root, темна в [data-theme="dark"]. */
export function toCSS(palette) {
  const lines = [`/* Token Lab - ${palette.input} */`, ':root {'];
  for (const s of STEPS) lines.push(`  --brand-${s}: ${palette.brand[s]};`);
  for (const s of STEPS) lines.push(`  --neutral-${s}: ${palette.neutral[s]};`);
  lines.push('');
  for (const name of TOKEN_NAMES) lines.push(`  --${name}: ${cssValue(palette.themes.light[name])};`);
  lines.push('}', '', '[data-theme="dark"] {');
  for (const name of TOKEN_NAMES) lines.push(`  --${name}: ${cssValue(palette.themes.dark[name])};`);
  lines.push('}');
  return lines.join('\n') + '\n';
}
