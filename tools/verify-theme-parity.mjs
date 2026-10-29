#!/usr/bin/env node
/**
 * Proves a tokenisation refactor changed nothing on screen.
 *
 *   node tools/verify-theme-parity.mjs <before.css> <after.css>
 *
 * For every rule in each stylesheet it resolves var() chains down to literal
 * values and builds a map of
 *
 *   (media query, selector, longhand property) -> computed value
 *
 * once for the light theme and once for dark, then diffs the two stylesheets'
 * maps. Moving a colour into a token, or replacing a `[data-theme="dark"] X`
 * element rule with a token override, leaves these maps identical -- so any
 * reported difference is a real visual change.
 *
 * Border shorthands are expanded to longhands, so `border: 1px solid <c>`
 * compares equal to a base `border` plus a `border-color` override.
 */

import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const DARK_PREFIX = '[data-theme="dark"]';

/* ---------- token collection ---------- */

function collectTokens(root) {
  const light = new Map();
  const dark = new Map();

  root.walkRules((rule) => {
    const selectors = rule.selectors || [];
    const isRoot = selectors.includes(':root');
    const isDark = selectors.includes(DARK_PREFIX);
    if (!isRoot && !isDark) return;

    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith('--')) return;
      if (isRoot) light.set(decl.prop, decl.value.trim());
      if (isDark) dark.set(decl.prop, decl.value.trim());
    });
  });

  /* Dark inherits every token it does not override. */
  const darkResolved = new Map(light);
  for (const [k, v] of dark) darkResolved.set(k, v);

  return { light, dark: darkResolved };
}

/* ---------- var() resolution ---------- */

function resolve(value, tokens, depth = 0) {
  if (depth > 20) return value;
  if (!value.includes('var(')) return value;

  /* Innermost var() first, so nested references collapse cleanly. */
  const replaced = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (whole, name, fallback) => {
    if (tokens.has(name)) return tokens.get(name);
    if (fallback !== undefined) return fallback.trim();
    return whole;
  });

  return replaced === value ? value : resolve(replaced, tokens, depth + 1);
}

/* ---------- shorthand expansion ---------- */

const BORDER_SIDES = ['top', 'right', 'bottom', 'left'];

/* Splits "1px solid red" into its width/style/colour parts. Good enough for
   this stylesheet, which always writes them in that order. */
function splitBorder(value) {
  const parts = value.match(/(?:[^\s(]+|\([^)]*\)|[a-z-]+\([^)]*\))+/gi) || [];
  const out = {};
  for (const p of parts) {
    if (/^(thin|medium|thick|[\d.]+(px|rem|em|%)?)$/i.test(p)) out.width = p;
    else if (/^(none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)$/i.test(p)) out.style = p;
    else out.color = p;
  }
  return out;
}

function expand(prop, value) {
  const p = prop.toLowerCase();

  if (p === 'border') {
    const { width, style, color } = splitBorder(value);
    const out = [];
    for (const side of BORDER_SIDES) {
      if (width) out.push([`border-${side}-width`, width]);
      if (style) out.push([`border-${side}-style`, style]);
      if (color) out.push([`border-${side}-color`, color]);
    }
    return out;
  }

  if (p === 'border-color') {
    return BORDER_SIDES.map((s) => [`border-${s}-color`, value]);
  }

  const sideMatch = p.match(/^border-(top|right|bottom|left)$/);
  if (sideMatch) {
    const { width, style, color } = splitBorder(value);
    const side = sideMatch[1];
    const out = [];
    if (width) out.push([`border-${side}-width`, width]);
    if (style) out.push([`border-${side}-style`, style]);
    if (color) out.push([`border-${side}-color`, color]);
    return out;
  }

  return [[p, value]];
}

/* ---------- build the computed map ---------- */

function mediaOf(node) {
  const chain = [];
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === 'atrule') chain.unshift(`@${p.name} ${p.params}`);
  }
  return chain.join(' | ');
}

/**
 * @param theme 'light' | 'dark'
 * Returns Map of "media||selector||prop" -> computed value.
 */
function computedMap(root, tokens, theme) {
  const base = new Map();
  const darkOverride = new Map();

  root.walkRules((rule) => {
    for (const rawSel of rule.selectors || []) {
      const sel = rawSel.trim();
      if (sel === ':root' || sel === DARK_PREFIX) continue;

      const isDarkScoped = sel.startsWith(DARK_PREFIX);
      /* Dark-scoped rules never apply in the light theme. */
      if (isDarkScoped && theme === 'light') continue;

      const plainSel = isDarkScoped ? sel.slice(DARK_PREFIX.length).trim() : sel;
      const media = mediaOf(rule);

      rule.walkDecls((decl) => {
        if (decl.prop.startsWith('--')) return;
        const resolved = resolve(decl.value.trim(), tokens);
        for (const [prop, val] of expand(decl.prop, resolved)) {
          const key = `${media}||${plainSel}||${prop}`;
          (isDarkScoped ? darkOverride : base).set(key, val.trim());
        }
      });
    }
  });

  /* A dark-scoped rule outranks the base rule it shadows. */
  const out = new Map(base);
  for (const [k, v] of darkOverride) out.set(k, v);
  return out;
}

/* ---------- compare ---------- */

function load(path) {
  const root = postcss.parse(readFileSync(path, 'utf8'));
  const tokens = collectTokens(root);
  return {
    light: computedMap(root, tokens.light, 'light'),
    dark: computedMap(root, tokens.dark, 'dark'),
  };
}

function diff(theme, before, after) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  const problems = [];

  for (const key of [...keys].sort()) {
    const b = before.get(key);
    const a = after.get(key);
    const [media, sel, prop] = key.split('||');
    const where = `${sel} { ${prop} }${media ? `  in ${media}` : ''}`;

    if (b === undefined) problems.push({ kind: 'ADDED', where, before: '-', after: a });
    else if (a === undefined) problems.push({ kind: 'REMOVED', where, before: b, after: '-' });
    else if (norm(b) !== norm(a)) problems.push({ kind: 'CHANGED', where, before: b, after: a });
  }

  return problems;
}

/* Colour and whitespace spellings that mean the same thing to a browser. */
function norm(v) {
  let s = v.toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();
  const hex3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (hex3) s = `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`;
  return s;
}

function main() {
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    console.error('usage: node tools/verify-theme-parity.mjs <before.css> <after.css>');
    process.exit(2);
  }

  const before = load(beforePath);
  const after = load(afterPath);

  let total = 0;
  for (const theme of ['light', 'dark']) {
    const problems = diff(theme, before[theme], after[theme]);
    console.log(`\n=== ${theme.toUpperCase()} theme: ${before[theme].size} declarations compared ===`);

    if (!problems.length) {
      console.log('  identical - no computed value changed');
      continue;
    }

    total += problems.length;
    for (const p of problems.slice(0, 40)) {
      console.log(`  ${p.kind.padEnd(8)} ${p.where}`);
      console.log(`           before: ${p.before}`);
      console.log(`           after : ${p.after}`);
    }
    if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
  }

  console.log(
    total === 0
      ? '\nPASS - both themes render identically.'
      : `\nFAIL - ${total} computed value difference(s).`
  );
  process.exit(total === 0 ? 0 : 1);
}

main();
