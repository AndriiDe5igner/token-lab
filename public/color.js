// Математика кольору Token Lab.
// Чисті функції без DOM. Назовні - тільки hex-рядки і числа.
// Шкали будуються в OKLCH, щоб кроки були рівними на око.

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Криві взято з макета в design/ (виміряно в OKLCH).
// Цільова світлість OKLCH для кожного кроку (50 - найсвітліший).
const LIGHTNESS = [0.976, 0.946, 0.889, 0.815, 0.716, 0.631, 0.55, 0.475, 0.395, 0.319, 0.24];

// Відносна хрома кроку: біля країв шкали колір приглушується.
const CHROMA_CURVE = [0.05, 0.11, 0.22, 0.38, 0.6, 0.8, 1, 1, 0.93, 0.81, 0.65];

// Хрома neutral: легкий тон бренду, не більше NEUTRAL_MAX_CHROMA, тихіше на краях.
const NEUTRAL_CHROMA_RATIO = 0.12;
const NEUTRAL_MAX_CHROMA = 0.012;
const NEUTRAL_CHROMA_CURVE = [0.15, 0.25, 0.55, 0.7, 0.85, 1, 1, 0.95, 0.9, 0.9, 0.7];

const ACHROMATIC = 1e-4;

// ---------- hex ----------

/**
 * Приводить ввід до `#rrggbb`. Приймає `#RGB`, `#RRGGBB`, з `#` або без,
 * будь-який регістр, пробіли по краях. Невалідний ввід -> null.
 */
export function normalizeHex(input) {
  if (typeof input !== 'string') return null;
  const m = input.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  return '#' + hex;
}

export function isValidHex(input) {
  return normalizeHex(input) !== null;
}

function requireHex(input) {
  const hex = normalizeHex(input);
  if (!hex) throw new TypeError(`Невалідний hex: ${String(input)}`);
  return hex;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

// ---------- sRGB <-> OKLab <-> OKLCH (Björn Ottosson) ----------

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function linearRgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function hexToOklch(hex) {
  const [L, a, b] = linearRgbToOklab(hexToRgb(hex).map(toLinear));
  const C = Math.hypot(a, b);
  const h = C < ACHROMATIC ? 0 : (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C, h: (h + 360) % 360 };
}

function oklchToLinearRgb({ L, C, h }) {
  const rad = (h * Math.PI) / 180;
  return oklabToLinearRgb([L, C * Math.cos(rad), C * Math.sin(rad)]);
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

/** OKLCH -> hex. Якщо колір поза sRGB - зменшуємо хрому (L і h зберігаються). */
function oklchToHex({ L, C, h }) {
  L = Math.min(1, Math.max(0, L));
  let rgb = oklchToLinearRgb({ L, C, h });
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb({ L, C: mid, h }))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinearRgb({ L, C: lo, h });
  }
  return rgbToHex(rgb.map((v) => toGamma(Math.min(1, Math.max(0, v)))));
}

// ---------- шкали ----------

function nearestStepIndex(L) {
  let best = 0;
  for (let i = 1; i < LIGHTNESS.length; i++) {
    if (Math.abs(LIGHTNESS[i] - L) < Math.abs(LIGHTNESS[best] - L)) best = i;
  }
  return best;
}

// Світлість кроків з якорем: якір отримує L вхідного кольору, решта кривої
// лінійно стискається / розтягується між якорем і краями. Порядок зберігається.
// Якщо якір - крайній крок (дуже світлий або дуже темний ввід), решту кривої
// не чіпаємо, інакше сусідні кроки злипаються.
function anchoredLightness(anchor, Lin) {
  const last = LIGHTNESS.length - 1;
  if (anchor === 0 || anchor === last) {
    return LIGHTNESS.map((Lt, i) => (i === anchor ? Lin : Lt));
  }
  const top = LIGHTNESS[0];
  const bottom = LIGHTNESS[last];
  const La = LIGHTNESS[anchor];
  return LIGHTNESS.map((Lt, i) => {
    if (i === anchor) return Lin;
    if (i < anchor) return Lin + ((Lt - La) * (top - Lin)) / (top - La);
    return Lin - ((La - Lt) * (Lin - bottom)) / (La - bottom);
  });
}

function toScaleObject(hexes) {
  return Object.fromEntries(STEPS.map((step, i) => [step, hexes[i]]));
}

/**
 * Брендова шкала 50…950. Вхідний колір стає найближчим за світлістю кроком
 * і зберігається точно. Повертає { scale: { 50: '#…', … }, anchor: 600 }.
 */
export function brandScale(input) {
  const hex = requireHex(input);
  const { L, C, h } = hexToOklch(hex);
  const anchor = nearestStepIndex(L);
  const lightness = anchoredLightness(anchor, L);
  const hexes = lightness.map((Li, i) => {
    if (i === anchor) return hex;
    const k = Math.min(1, CHROMA_CURVE[i] / CHROMA_CURVE[anchor]);
    return oklchToHex({ L: Li, C: C * k, h });
  });
  return { scale: toScaleObject(hexes), anchor: STEPS[anchor] };
}

/** Нейтральна шкала 50…950 з легким тоном бренду. Повертає { 50: '#…', … }. */
export function neutralScale(input) {
  const hex = requireHex(input);
  const { C, h } = hexToOklch(hex);
  const Cn = Math.min(C * NEUTRAL_CHROMA_RATIO, NEUTRAL_MAX_CHROMA);
  return toScaleObject(LIGHTNESS.map((L, i) => oklchToHex({ L, C: Cn * NEUTRAL_CHROMA_CURVE[i], h })));
}

/** Рядок CSS для hex: 'oklch(51.1% 0.230 277.0)'. */
export function toOklchString(input) {
  const { L, C, h } = hexToOklch(requireHex(input));
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${h.toFixed(1)})`;
}

// ---------- контраст WCAG 2.x ----------

/** Відносна яскравість за WCAG, 0…1. */
export function relativeLuminance(input) {
  const [r, g, b] = hexToRgb(requireHex(input)).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст двох кольорів, 1…21. Порядок аргументів не важливий. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Рівень для звичайного тексту: 'AAA' | 'AA' | 'AA Large' | 'Fail'. Без округлення, як у WCAG. */
export function contrastLevel(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

/** З кандидатів повертає той, що має найбільший контраст з фоном. */
export function pickReadable(background, candidates) {
  let best = null;
  let bestRatio = -1;
  for (const c of candidates) {
    const r = contrastRatio(background, c);
    if (r > bestRatio) {
      best = normalizeHex(c);
      bestRatio = r;
    }
  }
  return best;
}
