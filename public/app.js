// UI Token Lab: стан, рендер, події.
// Кольори палітри передаються в DOM тільки через CSS-змінні (--c, --p-*, --chip-*).

import { STEPS, normalizeHex, toOklchString } from './color.js';
import { TOKEN_NAMES, buildPalette, contrastReport, pairContrast, toCSS } from './tokens.js';

const DEFAULT_HEX = '#4f46e5';

const PRESETS = [
  { name: 'Індиго', hex: '#4f46e5' },
  { name: 'Жовтий', hex: '#facc15' },
  { name: 'Бірюза', hex: '#0f766e' },
  { name: 'Теракота', hex: '#e4572e' },
];

const HEX_ERROR = 'Невалідний hex. Потрібно 3 або 6 символів 0-9 і A-F, наприклад 4F46E5.';

const state = { palette: null };

const $ = (id) => document.getElementById(id);
const els = {
  logoMark: document.querySelector('.logo-mark'),
  hexBox: $('hex-box'),
  hexInput: $('hex-input'),
  hexError: $('hex-error'),
  picker: $('picker'),
  pickerWrap: document.querySelector('.hex-picker'),
  presets: $('presets'),
  factStep: $('fact-step'),
  factOklch: $('fact-oklch'),
  factOnAccent: $('fact-on-accent'),
  scales: $('scales'),
  tokensTable: $('tokens-table'),
  previewLight: $('preview-light'),
  previewDark: $('preview-dark'),
  exportCode: document.querySelector('#export-code code'),
  copyBtn: $('copy-btn'),
  shareBtn: $('share-btn'),
  toast: $('toast'),
};

const upperHex = (hex) => hex.slice(1).toUpperCase();
const swatchVar = (hex) => `--c: ${hex}`;

// ---------- рендер ----------

function renderPanel(p) {
  for (const el of [els.logoMark, els.pickerWrap]) el.style.setProperty('--c', p.input);
  els.picker.value = p.input;
  if (document.activeElement !== els.hexInput) els.hexInput.value = upperHex(p.input);

  els.factStep.textContent = `brand-${p.anchor}`;
  els.factOklch.textContent = toOklchString(p.input);
  els.factOnAccent.textContent = `on-accent ${p.themes.light['on-accent'].ref}`;

  for (const btn of els.presets.children) {
    btn.setAttribute('aria-pressed', String(btn.dataset.hex === p.input));
  }
}

function renderScales(p) {
  const row = (label, kind, scale) => `
    <div class="scale-row">
      <p class="scale-label">${label}</p>
      <div class="swatches">
        ${STEPS.map((s) => {
          const hex = scale[s];
          const own = kind === 'brand' && s === p.anchor;
          return `
            <button class="swatch" type="button" data-copy="${upperHex(hex)}"
              aria-label="${kind}-${s} #${upperHex(hex)}${own ? ', твій колір' : ''}. Копіювати">
              <span class="swatch-color" style="${swatchVar(hex)}">${own ? '<span class="swatch-tag">твій</span>' : ''}</span>
              <span class="swatch-step">${s}</span>
              <span class="swatch-hex">${upperHex(hex)}</span>
            </button>`;
        }).join('')}
      </div>
    </div>`;
  els.scales.innerHTML = row('Brand', 'brand', p.brand) + row('Neutral', 'neutral', p.neutral);
}

function renderTokens(p) {
  const cell = (t) => `
    <div class="token-cell" role="cell">
      <span class="chip" style="${swatchVar(t.hex)}"></span>
      <span>${t.ref}</span>
      <span class="token-hex">#${upperHex(t.hex)}</span>
    </div>`;
  els.tokensTable.innerHTML = `
    <div class="table-row table-head" role="row">
      <span class="th-token" role="columnheader">ТОКЕН</span>
      <span role="columnheader">СВІТЛА</span>
      <span role="columnheader">ТЕМНА</span>
    </div>
    ${TOKEN_NAMES.map((name) => `
      <div class="table-row" role="row">
        <span class="token-name" role="rowheader">${name}</span>
        ${cell(p.themes.light[name])}
        ${cell(p.themes.dark[name])}
      </div>`).join('')}`;
}

const badge = (c, withRatio = true) =>
  `<span class="badge" data-pass="${c.pass}">${c.level}${withRatio ? ` ${c.ratio.toFixed(1)}` : ''}</span>`;

const PREVIEW_VARS = {
  bg: '--p-bg',
  surface: '--p-surface',
  text: '--p-text',
  'text-muted': '--p-muted',
  border: '--p-border',
  accent: '--p-accent',
  'accent-hover': '--p-accent-hover',
  'on-accent': '--p-on-accent',
  danger: '--p-danger',
  success: '--p-success',
};

function renderPreview(el, title, theme) {
  const report = contrastReport(theme);
  const passed = report.filter((r) => r.pass).length;
  const c = (fg, bg) => pairContrast(theme, fg, bg);
  const vars = Object.entries(PREVIEW_VARS)
    .map(([token, v]) => `${v}: ${theme[token].hex}`)
    .join('; ');

  el.innerHTML = `
    <div class="preview-head">
      <span>${title}</span>
      <span class="preview-score">${passed}/${report.length} пройдено</span>
    </div>
    <div class="canvas" style="${vars}">
      <div class="pv-card">
        <div class="pv-top">
          <span class="pv-kicker">Підписка</span>
          <span class="pv-row">
            <span class="pv-status"><span class="pv-dot"></span>Активна</span>
            ${badge(c('success', 'surface'))}
          </span>
        </div>
        <div class="pv-row">
          <p class="pv-title">Pro для дизайнерів</p>
          ${badge(c('text', 'surface'))}
        </div>
        <p class="pv-desc">Безлімітні палітри, експорт у Figma і спільний доступ для команди.</p>
        <div class="pv-field">
          <label class="pv-label" for="${el.id}-email">Email</label>
          <input class="pv-input" id="${el.id}-email" type="text" value="dmytro.uxhero" aria-invalid="true">
        </div>
        <div class="pv-row">
          <span class="pv-error">Бракує @ в адресі</span>
          ${badge(c('danger', 'surface'))}
        </div>
        <div class="pv-actions">
          <button class="pv-btn pv-btn-primary" type="button">Оформити</button>
          <button class="pv-btn pv-btn-hover" type="button">Наведення</button>
          <button class="pv-btn pv-btn-outline" type="button">Пізніше</button>
          ${badge(c('on-accent', 'accent'))}
        </div>
      </div>
      <div class="pv-foot">
        <span>Оновлено 2 хв тому</span>
        ${badge(c('text-muted', 'bg'))}
      </div>
    </div>
    <div class="pairs">
      ${report.map((r) => `
        <div class="pair">
          <span class="pair-chip" style="--chip-bg: ${theme[r.bg].hex}; --chip-fg: ${theme[r.fg].hex}" aria-hidden="true">Aa</span>
          <span class="pair-text">
            <span>${r.label}</span>
            <span class="pair-tokens">· ${r.fg} / ${r.bg}</span>
          </span>
          <span class="pair-ratio">${r.ratio.toFixed(2)}:1</span>
          ${badge(r, false)}
        </div>`).join('')}
    </div>`;
}

function renderExport(p) {
  els.exportCode.textContent = toCSS(p);
}

function render() {
  const p = state.palette;
  renderPanel(p);
  renderScales(p);
  renderTokens(p);
  renderPreview(els.previewLight, 'Світла тема', p.themes.light);
  renderPreview(els.previewDark, 'Темна тема', p.themes.dark);
  renderExport(p);
}

function apply(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return;
  if (state.palette && state.palette.input === normalized) return;
  state.palette = buildPalette(normalized);
  render();
}

// ---------- поле hex ----------

function setError(message) {
  els.hexError.textContent = message;
  els.hexError.hidden = !message;
  els.hexInput.setAttribute('aria-invalid', String(Boolean(message)));
  els.hexBox.toggleAttribute('data-invalid', Boolean(message));
}

function onHexInput() {
  const raw = els.hexInput.value;
  const value = raw.replace(/[\s#]/g, '');
  if (value !== raw) els.hexInput.value = value;

  if (/[^0-9a-f]/i.test(value) || value.length > 6) {
    setError(HEX_ERROR);
    return;
  }
  setError('');
  // Під час набору застосовуємо тільки повні 6 символів, щоб шкала не блимала на "4F4".
  if (value.length === 6) apply(`#${value}`);
}

function onHexCommit() {
  const hex = normalizeHex(els.hexInput.value);
  if (!hex) {
    setError(HEX_ERROR);
    return;
  }
  setError('');
  apply(hex);
  els.hexInput.value = upperHex(hex);
}

// ---------- копіювання і тост ----------

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 1600);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast('Скопійовано');
}

// ---------- старт ----------

function init() {
  els.presets.innerHTML = PRESETS.map((p) => `
    <button class="preset" type="button" data-hex="${p.hex}" aria-pressed="false">
      <span class="preset-dot" style="${swatchVar(p.hex)}"></span>${p.name}
    </button>`).join('');

  els.presets.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset');
    if (!btn) return;
    setError('');
    els.hexInput.value = upperHex(btn.dataset.hex);
    apply(btn.dataset.hex);
  });

  els.hexInput.addEventListener('input', onHexInput);
  els.hexInput.addEventListener('change', onHexCommit);
  els.hexInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onHexCommit();
  });

  els.picker.addEventListener('input', () => {
    setError('');
    els.hexInput.value = upperHex(els.picker.value);
    apply(els.picker.value);
  });

  els.scales.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (btn) copy(`#${btn.dataset.copy}`);
  });

  els.copyBtn.addEventListener('click', () => copy(els.exportCode.textContent));
  els.shareBtn.addEventListener('click', () => toast('Поділитися з’явиться в наступному кроці'));

  apply(DEFAULT_HEX);
}

init();
