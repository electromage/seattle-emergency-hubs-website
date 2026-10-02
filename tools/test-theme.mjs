#!/usr/bin/env node
/**
 * Exercises the real js/theme.js and the real inline <head> script against a
 * minimal DOM stub.
 *
 *   npm run test:theme
 *
 * There is no browser in this project, so this is what stands between a
 * working theme picker and one that silently does nothing: shareable
 * ?theme= links, the saved choice a returning visitor gets, resetting to the
 * default, and a stale link naming a theme that no longer exists.
 */
import { readFileSync } from 'node:fs';

/**
 * The pre-paint theme script is inlined in every page's <head>, so read it
 * out of index.html rather than keeping a second copy here -- that way this
 * test fails if the real page and this test ever drift apart.
 */
function bootScript() {
  const html = readFileSync('index.html', 'utf8');
  const m = html.match(/<script>(try\{var q[\s\S]*?)<\/script>/);
  if (!m) {
    console.error('test:theme  could not find the inline theme script in index.html');
    process.exit(2);
  }
  return m[1];
}

function makeEnv(search = '', stored = {}) {
  const store = { ...stored };
  const attrs = {};
  const listeners = {};
  const el = () => ({
    className: '', id: '', title: '', textContent: '', value: '', selected: false,
    children: [], style: {},
    setAttribute(k, v) { this[k] = v; }, appendChild(c) { this.children.push(c); },
    addEventListener(t, fn) { this['on' + t] = fn; },
    querySelector() { return null; }, insertBefore(n) { this.children.push(n); },
  });
  const header = { ...el(), _picker: null,
    querySelector(sel) { return sel === '.theme-picker' ? this._picker : (sel === '.theme-toggle' ? null : null); },
    appendChild(c) { this.children.push(c); this._picker = c; } };

  const env = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    location: { search },
    documentElement: {
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      setAttribute: (k, v) => { attrs[k] = v; },
      removeAttribute: (k) => { delete attrs[k]; },
    },
    document: {
      readyState: 'complete',
      documentElement: null,
      querySelectorAll: () => [],
      querySelector: (s) => (s === '.header-inner' ? header : null),
      createElement: () => el(),
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      dispatchEvent: (e) => { (listeners[e.type] || []).forEach((f) => f(e)); },
    },
    attrs, store, header, listeners,
  };
  env.document.documentElement = env.documentElement;
  return env;
}

function run(env) {
  const boot = bootScript();
  const theme = readFileSync('js/theme.js', 'utf8');
  const sandbox = {
    localStorage: env.localStorage, location: env.location, document: env.document,
    getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }),
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    MutationObserver: class { observe() {} },
    URLSearchParams,
    window: {},
  };
  sandbox.window = sandbox;
  const fn = new Function(...Object.keys(sandbox), boot + '\n' + theme);
  fn(...Object.values(sandbox));
  return sandbox;
}

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
}

console.log('\n?theme=beacon link');
let env = makeEnv('?theme=beacon');
let sb = run(env);
check('data-skin applied pre-paint', env.attrs['data-skin'], 'beacon');
check('saved for later pages', env.store['seh-skin'], 'beacon');
check('picker reports it', sb.window.SEHTheme.get(), 'beacon');

console.log('\n?theme=sound&mode=dark link');
env = makeEnv('?theme=sound&mode=dark');
sb = run(env);
check('skin applied', env.attrs['data-skin'], 'sound');
check('dark applied', env.attrs['data-theme'], 'dark');
check('dark persisted', env.store['seh-theme'], 'dark');

console.log('\nreturning visitor (saved skin, no query)');
env = makeEnv('', { 'seh-skin': 'rainier' });
sb = run(env);
check('saved skin restored', env.attrs['data-skin'], 'rainier');

console.log('\n?theme= resets to default');
env = makeEnv('?theme=', { 'seh-skin': 'beacon' });
sb = run(env);
check('no data-skin attribute', env.attrs['data-skin'], undefined);
check('storage cleared', env.store['seh-skin'], '');

console.log('\nunknown skin from a stale link');
env = makeEnv('?theme=notreal');
sb = run(env);
check('falls back to default', sb.window.SEHTheme.get(), '');
check('bogus attribute removed', env.attrs['data-skin'], undefined);

console.log('\nswitching at runtime');
env = makeEnv('');
sb = run(env);
sb.window.SEHTheme.set('beacon');
check('applied', env.attrs['data-skin'], 'beacon');
check('persisted', env.store['seh-skin'], 'beacon');
sb.window.SEHTheme.set('');
check('back to default removes attribute', env.attrs['data-skin'], undefined);

console.log('\npicker mounted into header');
env = makeEnv('');
sb = run(env);
check('a control was added', !!env.header._picker, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
