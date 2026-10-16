import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS,
  normalizeHex,
  isValidHex,
  brandScale,
  neutralScale,
  relativeLuminance,
  contrastRatio,
  contrastLevel,
  pickReadable,
} from '../public/color.js';

const HEX = /^#[0-9a-f]{6}$/;
const SAMPLES = ['#4F46E5', '#FACC15', '#000000', '#ffffff', '#00ff00', '#808080', '#e11d48'];

function assertDescendingLuminance(scale, label) {
  const lum = STEPS.map((s) => relativeLuminance(scale[s]));
  for (let i = 1; i < lum.length; i++) {
    assert.ok(
      lum[i] < lum[i - 1],
      `${label}: крок ${STEPS[i]} (${scale[STEPS[i]]}) не темніший за ${STEPS[i - 1]} (${scale[STEPS[i - 1]]})`,
    );
  }
}

test('normalizeHex: валідні формати', () => {
  assert.equal(normalizeHex('#4F46E5'), '#4f46e5');
  assert.equal(normalizeHex('4f46e5'), '#4f46e5');
  assert.equal(normalizeHex('  #FACC15 '), '#facc15');
  assert.equal(normalizeHex('#abc'), '#aabbcc');
  assert.equal(normalizeHex('FFF'), '#ffffff');
});

test('normalizeHex: невалідний ввід -> null', () => {
  for (const bad of ['', '#', '#12', '#1234', '#12345', '#1234567', '#ggg', 'red', 'rgb(0,0,0)', null, undefined, 123]) {
    assert.equal(normalizeHex(bad), null, `очікували null для ${String(bad)}`);
    assert.equal(isValidHex(bad), false);
  }
});

test('brandScale і neutralScale кидають TypeError на невалідний hex', () => {
  assert.throws(() => brandScale('nope'), TypeError);
  assert.throws(() => neutralScale('#12'), TypeError);
});

test('шкали: 11 кроків, усі значення #rrggbb', () => {
  for (const hex of SAMPLES) {
    const { scale } = brandScale(hex);
    const neutral = neutralScale(hex);
    assert.deepEqual(Object.keys(scale).map(Number), STEPS);
    assert.deepEqual(Object.keys(neutral).map(Number), STEPS);
    for (const s of STEPS) {
      assert.match(scale[s], HEX, `brand ${hex} ${s}`);
      assert.match(neutral[s], HEX, `neutral ${hex} ${s}`);
    }
  }
});

test('шкали: світлість строго спадає від 50 до 950', () => {
  for (const hex of SAMPLES) {
    assertDescendingLuminance(brandScale(hex).scale, `brand ${hex}`);
    assertDescendingLuminance(neutralScale(hex), `neutral ${hex}`);
  }
});

test('вхідний колір зберігається точно на кроці-якорі', () => {
  for (const hex of SAMPLES) {
    const { scale, anchor } = brandScale(hex);
    assert.ok(STEPS.includes(anchor));
    assert.equal(scale[anchor], normalizeHex(hex));
  }
});

test('якір: #4F46E5 -> 600, #FACC15 -> 200, #fff -> 50, #000 -> 950', () => {
  assert.equal(brandScale('#4F46E5').anchor, 600);
  assert.equal(brandScale('#FACC15').anchor, 200);
  assert.equal(brandScale('#ffffff').anchor, 50);
  assert.equal(brandScale('#000000').anchor, 950);
});

test('neutral майже сірий: розкид каналів RGB невеликий', () => {
  for (const hex of SAMPLES) {
    const neutral = neutralScale(hex);
    for (const s of STEPS) {
      const n = parseInt(neutral[s].slice(1), 16);
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      assert.ok(Math.max(...ch) - Math.min(...ch) <= 16, `neutral ${hex} ${s} = ${neutral[s]}`);
    }
  }
});

test('сірий ввід дає сіру brand-шкалу', () => {
  const { scale } = brandScale('#808080');
  for (const s of STEPS) {
    const [, r, g, b] = scale[s].match(/^#(..)(..)(..)$/);
    assert.ok(r === g && g === b, `${s} = ${scale[s]}`);
  }
});

test('relativeLuminance: чорний 0, білий 1', () => {
  assert.equal(relativeLuminance('#000'), 0);
  assert.equal(relativeLuminance('#fff'), 1);
});

test('contrastRatio: відомі пари', () => {
  assert.equal(contrastRatio('#000', '#fff'), 21);
  assert.equal(contrastRatio('#4f46e5', '#4f46e5'), 1);
  assert.equal(contrastRatio('#fff', '#000'), contrastRatio('#000', '#fff'));
  // #777 на білому - класичний приклад "майже AA".
  assert.ok(Math.abs(contrastRatio('#777777', '#ffffff') - 4.48) < 0.01);
  // Tailwind indigo-600 на білому ~ 6.29.
  assert.ok(Math.abs(contrastRatio('#4f46e5', '#ffffff') - 6.29) < 0.02);
});

test('contrastLevel: межі без округлення', () => {
  assert.equal(contrastLevel(21), 'AAA');
  assert.equal(contrastLevel(7), 'AAA');
  assert.equal(contrastLevel(6.99), 'AA');
  assert.equal(contrastLevel(4.5), 'AA');
  assert.equal(contrastLevel(4.49), 'AA Large');
  assert.equal(contrastLevel(3), 'AA Large');
  assert.equal(contrastLevel(2.99), 'Fail');
  assert.equal(contrastLevel(1), 'Fail');
  assert.equal(contrastLevel(contrastRatio('#777777', '#ffffff')), 'AA Large');
});

test('pickReadable: on-accent для індиго білий, для жовтого темний', () => {
  const indigo = brandScale('#4F46E5');
  const yellow = brandScale('#FACC15');
  const darkIndigo = neutralScale('#4F46E5')[950];
  const darkYellow = neutralScale('#FACC15')[950];
  assert.equal(pickReadable(indigo.scale[indigo.anchor], ['#ffffff', darkIndigo]), '#ffffff');
  assert.equal(pickReadable(yellow.scale[yellow.anchor], ['#ffffff', darkYellow]), darkYellow);
  assert.ok(contrastRatio('#facc15', darkYellow) >= 4.5);
});
