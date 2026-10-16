import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_NAMES, buildPalette, contrastReport, toCSS } from '../public/tokens.js';

const refs = (theme) => Object.fromEntries(Object.entries(theme).map(([k, v]) => [k, v.ref]));

test('індиго: мапінг як у таблиці макета', () => {
  const { themes } = buildPalette('#4F46E5');
  assert.deepEqual(refs(themes.light), {
    bg: 'neutral-50',
    surface: 'white',
    text: 'neutral-950',
    'text-muted': 'neutral-600',
    border: 'neutral-200',
    accent: 'brand-700',
    'accent-hover': 'brand-800',
    'on-accent': 'white',
    danger: 'danger-600',
    success: 'success-700',
  });
  assert.deepEqual(refs(themes.dark), {
    bg: 'neutral-950',
    surface: 'neutral-900',
    text: 'neutral-50',
    'text-muted': 'neutral-400',
    border: 'neutral-800',
    accent: 'brand-400',
    'accent-hover': 'brand-300',
    'on-accent': 'neutral-950',
    danger: 'danger-400',
    success: 'success-400',
  });
  assert.equal(themes.light.accent.hex, '#4f46e5');
});

test('жовтий: on-accent темний в обох темах, accent - сам жовтий', () => {
  const { themes } = buildPalette('#FACC15');
  assert.equal(themes.light.accent.hex, '#facc15');
  assert.equal(themes.light['on-accent'].ref, 'neutral-950');
  assert.equal(themes.dark['on-accent'].ref, 'neutral-950');
});

test('усі токени мають ref і hex для будь-якого кольору', () => {
  for (const hex of ['#4F46E5', '#FACC15', '#0f766e', '#e4572e', '#000', '#fff']) {
    const { themes } = buildPalette(hex);
    for (const t of ['light', 'dark']) {
      for (const name of TOKEN_NAMES) {
        assert.match(themes[t][name].hex, /^#[0-9a-f]{6}$/, `${hex} ${t} ${name}`);
      }
    }
  }
});

test('on-accent завжди проходить AA для індиго і жовтого', () => {
  for (const hex of ['#4F46E5', '#FACC15']) {
    for (const t of ['light', 'dark']) {
      const row = contrastReport(buildPalette(hex).themes[t]).find((r) => r.fg === 'on-accent');
      assert.ok(row.pass, `${hex} ${t}: ${row.ratio}`);
    }
  }
});

test('text-muted проходить AA на bg для пресетів в обох темах', () => {
  for (const hex of ['#4F46E5', '#FACC15', '#0f766e', '#e4572e']) {
    for (const t of ['light', 'dark']) {
      const row = contrastReport(buildPalette(hex).themes[t]).find((r) => r.fg === 'text-muted' && r.bg === 'bg');
      assert.ok(row.pass, `${hex} ${t}: ${row.ratio.toFixed(2)}`);
    }
  }
});

test('звіт контрасту: індиго 7/7 в обох темах', () => {
  const { themes } = buildPalette('#4F46E5');
  for (const t of ['light', 'dark']) {
    const report = contrastReport(themes[t]);
    assert.equal(report.length, 7);
    assert.ok(report.every((r) => r.pass), `${t}: ${report.filter((r) => !r.pass).map((r) => r.label)}`);
  }
});

test('toCSS: примітиви, обидві теми, посилання на змінні', () => {
  const css = toCSS(buildPalette('#4F46E5'));
  assert.match(css, /^\/\* Token Lab - #4f46e5 \*\//);
  assert.match(css, /--brand-700: #4f46e5;/);
  assert.match(css, /--neutral-950: #[0-9a-f]{6};/);
  assert.match(css, /--accent: var\(--brand-700\);/);
  assert.match(css, /\[data-theme="dark"\] \{[\s\S]*--accent: var\(--brand-400\);/);
  assert.match(css, /--surface: #ffffff;/);
  for (const name of TOKEN_NAMES) assert.equal(css.split(`  --${name}:`).length - 1, 2, name);
});

test('buildPalette кидає TypeError на невалідний hex', () => {
  assert.throws(() => buildPalette('zzz'), TypeError);
});
