#!/usr/bin/env node
/**
 * Checks every theme for legibility, in light AND dark.
 *
 *   npm run check:contrast
 *
 * Shipping a palette nobody can read is the main risk of having several, so
 * this resolves each skin the way a browser would -- style.css tokens, then
 * the dark overrides, then the skin's own block -- and measures the WCAG
 * contrast of the pairs that actually meet on screen.
 *
 * Thresholds follow WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text
 * (headings) and for UI borders that carry meaning.
 */

import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const STYLE = 'css/style.css';
const THEMES = 'css/themes.css';

/* ---------- token cascade ---------- */

function blocks(file) {
  const root = postcss.parse(readFileSync(file, 'utf8'));
  const out = [];
  root.walkRules((rule) => {
    const decls = {};
    rule.walkDecls((d) => { if (d.prop.startsWith('--')) decls[d.prop] = d.value.trim(); });
    if (Object.keys(decls).length) out.push({ sel: rule.selector.trim(), decls });
  });
  return out;
}

const styleBlocks = blocks(STYLE);
const themeBlocks = blocks(THEMES);

function skinIds() {
  const ids = new Set();
  for (const b of themeBlocks) {
    const m = b.sel.match(/\[data-skin="([\w-]+)"\]/);
    if (m) ids.add(m[1]);
  }
  return ['', ...ids];
}

/** Resolve the token set a browser would end up with for this skin+mode. */
function resolveTokens(skin, dark) {
  const t = {};
  for (const b of styleBlocks) {
    if (b.sel === ':root') Object.assign(t, b.decls);
  }
  if (dark) {
    for (const b of styleBlocks) {
      if (b.sel === '[data-theme="dark"]') Object.assign(t, b.decls);
    }
  }
  if (skin) {
    for (const b of themeBlocks) {
      const isSkin = b.sel.includes(`[data-skin="${skin}"]`);
      if (!isSkin) continue;
      /* The light selector carries [data-theme="dark"] INSIDE :not(), so test
         for the negation first and only then for a real dark block. */
      const isLightBlock = b.sel.includes(':not([data-theme="dark"])');
      const isDarkBlock = !isLightBlock && b.sel.includes('[data-theme="dark"]');
      if (dark ? isDarkBlock : isLightBlock) Object.assign(t, b.decls);
    }
  }
  return t;
}

function deref(value, tokens, depth = 0) {
  if (depth > 20 || !value || !value.includes('var(')) return value;
  const next = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (whole, name, fb) =>
    tokens[name] !== undefined ? tokens[name] : (fb !== undefined ? fb.trim() : whole)
  );
  return next === value ? value : deref(next, tokens, depth + 1);
}

/* ---------- colour maths ---------- */

function parse(c) {
  if (!c) return null;
  c = c.trim();
  let m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
  m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  if (/^#fff$|^white$/i.test(c)) return [255, 255, 255];
  return null;
}

const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

function ratio(a, b) {
  const x = parse(a), y = parse(b);
  if (!x || !y) return null;
  const l1 = lum(x), l2 = lum(y);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/* ---------- the pairs that actually meet on screen ---------- */

const PAIRS = [
  ['--color-text',        '--color-bg',           4.5, 'body text on page'],
  ['--color-text',        '--color-surface',      4.5, 'body text on card'],
  ['--color-muted',       '--color-bg',           4.5, 'muted text on page'],
  ['--color-muted',       '--color-surface',      4.5, 'muted text on card'],
  ['--color-heading',     '--color-bg',           3.0, 'heading on page'],
  ['--color-on-brand',    '--color-primary',      4.5, 'button text on primary'],
  ['--color-on-brand',    '--color-secondary',    4.5, 'button text on secondary'],
  ['--color-on-brand',    '--color-accent',       4.5, 'button text on accent'],
  ['--color-on-alert',    '--color-alert',        4.5, 'alpha banner text'],
  ['--color-footer-text', '--color-footer-bg',    4.5, 'footer text'],
  ['--color-text',        '--surface-info',       4.5, 'text in info notice'],
  ['--color-text',        '--surface-warning',    4.5, 'text in warning notice'],
  ['--color-success',     '--surface-success',    4.5, 'success text on its panel'],
  ['--color-danger',      '--surface-danger',     4.5, 'danger text on its panel'],
  ['--badge-text',        '--badge-bg',           4.5, 'badge text'],
];

/**
 * Pairs that already fell short before any theming work, because they come
 * from the organisation's brand palette (see branding.html). They are
 * reported every run but do not fail the check: changing Medium Blue or
 * Signal Orange is a brand decision, not a code one. Remove an entry here
 * the day the brand colour changes.
 */
const PREEXISTING = new Set([
  'default/light/button text on primary',
  'default/dark/button text on primary',
  'default/light/button text on accent',
  'default/dark/button text on accent',
  'default/light/footer text',
  'default/light/success text on its panel',
]);

/**
 * The picker in js/theme.js and the blocks in css/themes.css have to agree:
 * an id in one and not the other is either a dead menu entry or a look nobody
 * can reach.
 */
function checkSkinList() {
  const js = readFileSync('js/theme.js', 'utf8');
  const listed = new Set();
  const block = js.match(/var SKINS = \[([\s\S]*?)\];/);
  if (block) {
    for (const m of block[1].matchAll(/id:\s*'([\w-]*)'/g)) listed.add(m[1]);
  }
  const styled = new Set(skinIds());

  const problems = [];
  for (const id of listed) if (!styled.has(id)) problems.push(`  js/theme.js offers "${id}" but css/themes.css has no block for it`);
  for (const id of styled) if (!listed.has(id)) problems.push(`  css/themes.css defines "${id}" but the picker in js/theme.js does not list it`);
  return problems;
}

function main() {
  let failures = 0, checks = 0;
  const known = [];

  const listProblems = checkSkinList();
  if (listProblems.length) {
    console.error('check:contrast  the theme list and the stylesheet disagree:\n');
    listProblems.forEach((p) => console.error(p));
    process.exit(1);
  }
  const onlyFail = !process.argv.includes('--verbose');

  for (const skin of skinIds()) {
    for (const dark of [false, true]) {
      const tokens = resolveTokens(skin, dark);
      const name = `${skin || 'default'} / ${dark ? 'dark' : 'light'}`;
      const rows = [];

      for (const [fg, bg, min, label] of PAIRS) {
        const f = deref(tokens[fg], tokens);
        const b = deref(tokens[bg], tokens);
        const r = ratio(f, b);
        checks += 1;
        if (r === null) { rows.push(['SKIP', label, `${f} on ${b}`, '-', min]); continue; }
        const ok = r >= min;
        const id = `${skin || 'default'}/${dark ? 'dark' : 'light'}/${label}`;
        if (!ok && PREEXISTING.has(id)) {
          known.push(`  ${label.padEnd(28)} ${r.toFixed(2)} (min ${min})  ${f} on ${b}  [${skin || 'default'}/${dark ? 'dark' : 'light'}]`);
          if (!onlyFail) rows.push(['pre', label, `${f} on ${b}`, r.toFixed(2), min]);
          continue;
        }
        if (!ok) failures += 1;
        if (!ok || !onlyFail) rows.push([ok ? 'ok' : 'FAIL', label, `${f} on ${b}`, r.toFixed(2), min]);
      }

      if (rows.length) {
        console.log(`\n=== ${name} ===`);
        for (const [st, label, colors, r, min] of rows) {
          console.log(`  ${st.padEnd(4)} ${label.padEnd(28)} ${String(r).padStart(5)} (min ${min})  ${colors}`);
        }
      }
    }
  }

  if (known.length) {
    console.log('\nPre-existing, in the brand palette rather than the theming (not failed):');
    known.forEach((k) => console.log(k));
  }

  console.log(
    failures === 0
      ? `\ncheck:contrast  OK - ${checks} pairs checked, ${known.length} known brand exception(s), no new failures`
      : `\ncheck:contrast  ${failures} of ${checks} pairs below WCAG AA`
  );
  process.exit(failures ? 1 : 0);
}

main();
