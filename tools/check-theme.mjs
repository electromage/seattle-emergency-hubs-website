#!/usr/bin/env node
/**
 * Keeps the theme layer airtight.
 *
 * Fails if a colour, shadow or gradient literal appears anywhere outside the
 * token blocks -- because a literal down in the rules is a value no theme can
 * reach, and it is exactly how a themeable stylesheet quietly stops being one.
 *
 *   npm run check:theme
 *
 * Legitimate exceptions exist: the brand's Dark Slate logo backdrop, a photo
 * lightbox that stays dark in both themes. Mark those with a comment containing
 * "theme-exempt" immediately above the declaration and this check skips them.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

const SKIP_DIRS = new Set(['node_modules', '.git', 'content']);

/* Every stylesheet, plus every page carrying an inline <style> block. Walked
   rather than listed, so a page added later is covered without anyone
   remembering to come back here -- a guard with a hardcoded list is a guard
   that silently stops covering the site. */
function findTargets(dir = '.', out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      findTargets(path, out);
    } else if (name.endsWith('.css')) {
      out.push({ path, kind: 'css' });
    } else if (name.endsWith('.html') && readFileSync(path, 'utf8').includes('<style')) {
      out.push({ path, kind: 'html' });
    }
  }
  return out;
}

/* Hex, rgb(), rgba(), hsl(), hsla(). Named colours are not matched: the
   stylesheet does not use them, and "transparent"/"currentColor"/"inherit"
   carry no theme information anyway. */
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

function styleBlocks(source, kind) {
  if (kind === 'css') return [source];
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
}

/** A rule whose selector is :root or [data-theme="..."] is the theme layer. */
function isTokenBlock(rule) {
  return (rule.selectors || []).every(
    (sel) => sel.trim() === ':root' || /^\[data-theme=("|')?[\w-]+\1?\]$/.test(sel.trim())
  );
}

const hasMarker = (node) => node.type === 'comment' && node.text.toLowerCase().includes('theme-exempt');

/**
 * Exemption is per rule, not per declaration: a component that deliberately
 * stands outside the theme does so as a whole, and marking one of its five
 * colours would be a trap for whoever edits the other four.
 */
function isExempt(rule) {
  if (rule.nodes?.some(hasMarker)) return true;

  /* Or a marker comment sitting directly above the rule. */
  let prev = rule.prev();
  while (prev && prev.type === 'comment') {
    if (hasMarker(prev)) return true;
    prev = prev.prev();
  }
  return false;
}

function main() {
  const violations = [];
  let scanned = 0;

  const targets = findTargets();

  for (const { path, kind } of targets) {
    let source;
    try {
      source = readFileSync(path, 'utf8');
    } catch {
      console.error(`check:theme  cannot read ${path}`);
      process.exit(2);
    }

    for (const block of styleBlocks(source, kind)) {
      const root = postcss.parse(block);

      root.walkRules((rule) => {
        if (isTokenBlock(rule)) return;
        if (isExempt(rule)) return;

        rule.walkDecls((decl) => {
          scanned += 1;
          if (decl.prop.startsWith('--')) return;
          if (!COLOR_LITERAL.test(decl.value)) return;

          violations.push({
            path,
            line: decl.source?.start?.line ?? 0,
            selector: rule.selector.replace(/\s+/g, ' ').slice(0, 58),
            text: `${decl.prop}: ${decl.value}`.slice(0, 72),
          });
        });
      });
    }
  }

  if (!violations.length) {
    console.log(
      `check:theme  OK - ${scanned} declarations across ${targets.length} file(s) scanned, ` +
        'every colour comes from a token'
    );
    return;
  }

  console.error(`check:theme  ${violations.length} colour literal(s) outside the theme layer:\n`);
  for (const v of violations) {
    console.error(`  ${v.path} (style block line ${v.line})`);
    console.error(`    ${v.selector} { ${v.text} }`);
  }
  console.error(
    '\nMove the value into a token in the theme layer of css/style.css and\n' +
      'reference it with var(), or if it genuinely must not follow the theme,\n' +
      'add a comment containing "theme-exempt" directly above the declaration.'
  );
  process.exit(1);
}

main();
