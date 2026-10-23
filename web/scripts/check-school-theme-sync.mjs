// Executes the real services with an in-memory transport and browser lifecycle. No school data.
import '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { Injector, NgZone, runInInjectionContext } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular', 'theme-sync-checks', 'services.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `
    export { SchoolThemeService } from './projects/parent-app/src/app/school-theme.service';
    export { ApplicationService, StaffService, SUPABASE_CLIENT, ThemeService, DEFAULT_THEME,
      normalizeTheme, PRIMARY_SWATCHES, SIDEBAR_SWATCHES } from './projects/shared/src/public-api';
  `, resolveDir: root, sourcefile: 'theme-check.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: path.join(root, 'tsconfig.json'),
});
const { SchoolThemeService, ApplicationService, StaffService, SUPABASE_CLIENT, ThemeService,
  DEFAULT_THEME, normalizeTheme, PRIMARY_SWATCHES, SIDEBAR_SWATCHES } = await import(pathToFileURL(output).href);

function browser(storage = new Map()) {
  const properties = new Map(), intervals = new Map();
  const doc = new EventTarget(), view = new EventTarget();
  let nextTimer = 0;
  doc.visibilityState = 'visible';
  doc.documentElement = { style: {
    setProperty: (key, value) => properties.set(key, value),
    removeProperty: key => properties.delete(key),
  }};
  view.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  view.setInterval = (callback, ms) => { assert.equal(ms, 30_000); intervals.set(++nextTimer, callback); return nextTimer; };
  view.clearInterval = id => intervals.delete(id);
  doc.defaultView = view;
  return { doc, view, properties, storage, intervals, tick: () => [...intervals.values()].forEach(fn => fn()) };
}
const outsideZone = { runOutsideAngular: fn => fn() };
function parentFixture(options = {}) {
  const dom = browser(options.storage);
  let response = DEFAULT_THEME, calls = 0;
  const injector = Injector.create({ providers: [
    { provide: DOCUMENT, useValue: dom.doc },
    { provide: NgZone, useValue: outsideZone },
    { provide: ApplicationService, useValue: { mySchoolTheme: () => {
      calls++;
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }}},
  ]});
  const service = runInInjectionContext(injector, () => new SchoolThemeService());
  return { ...dom, service, injector, respond: value => { response = value; }, calls: () => calls };
}
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function rgb(hex) { return hex.slice(1).match(/../g).map(c => parseInt(c, 16)); }
function blend(base, color, alpha) {
  return '#' + rgb(base).map((c, i) => Math.round(c * (1 - alpha) + rgb(color)[i] * alpha).toString(16).padStart(2, '0')).join('');
}
function contrast(a, b, label, minimum = 4.5) {
  const lum = hex => rgb(hex).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const x = lum(a), y = lum(b), ratio = (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  assert.ok(ratio >= minimum, `${label}: ${a} on ${b} = ${ratio.toFixed(2)}:1`);
}

// Saved settings round-trip through the real portal writer and parent reader.
let saved = { ...DEFAULT_THEME }, learnerRows, queryError = null;
const queryCalls = [];
const transport = { from(table) {
  queryCalls.push(['from', table]);
  if (table === 'schools') return { update(payload) { return { eq(column, id) {
    assert.equal(column, 'id'); assert.equal(id, 'school-a');
    saved = payload.theme;
    return { select: () => ({ single: async () => ({ data: { id, theme: saved }, error: null }) }) };
  } }; } };
  assert.equal(table, 'learners');
  const query = {
    select: value => { queryCalls.push(['select', value]); return query; },
    not: (...args) => { queryCalls.push(['not', ...args]); return query; },
    limit: async value => { queryCalls.push(['limit', value]); return {
      data: learnerRows === undefined ? [{ schools: { theme: saved } }] : learnerRows, error: queryError,
    }; },
  };
  return query;
} };
const dbInjector = Injector.create({ providers: [{ provide: SUPABASE_CLIENT, useValue: transport }] });
const applications = runInInjectionContext(dbInjector, () => new ApplicationService());
const staff = runInInjectionContext(dbInjector, () => new StaffService());
staff.currentSchoolId.set('school-a');
const custom = { primary: '#fb7d5b', header: '#14213d', sidebar: '#0b3d3a', mode: 'dark' };
await staff.saveTheme(custom);
assert.deepEqual(await applications.mySchoolTheme(), custom, 'All four saved settings reach the parent');
assert.deepEqual(queryCalls.slice(-4), [
  ['from', 'learners'], ['select', 'school_id, schools:school_id(theme)'], ['not', 'school_id', 'is', null], ['limit', 1],
], 'Theme sync preserves the existing school lookup');
learnerRows = [];
assert.equal(await applications.mySchoolTheme(), null);
learnerRows = [{ schools: null }];
assert.equal(await applications.mySchoolTheme(), null);
learnerRows = [{ schools: { theme: { primary: '#00ada3' } } }];
assert.deepEqual(await applications.mySchoolTheme(), { ...DEFAULT_THEME, primary: '#00ada3' });
for (const invalid of [null, [], 'bad', 42, { primary: 'red', header: '#fff', sidebar: 'url(x)', mode: 'other' }]) {
  assert.deepEqual(normalizeTheme(invalid), DEFAULT_THEME);
}
queryError = new Error('Unavailable');
await assert.rejects(applications.mySchoolTheme(), /Unavailable/);

// Unsaved previews never update the transport or the parent cache.
const portalDom = browser();
const portalInjector = Injector.create({ providers: [{ provide: DOCUMENT, useValue: portalDom.doc }] });
const portal = runInInjectionContext(portalInjector, () => new ThemeService());
portal.applyFromSchool({ theme: custom });
portal.preview({ primary: '#000000' });
assert.deepEqual(saved, custom);
assert.deepEqual(portal.current(), custom);
portal.resetPreview();
assert.equal(portalDom.properties.get('--brand'), custom.primary);

const parent = parentFixture();
const p = key => parent.properties.get(key);
const colors = [...new Set([DEFAULT_THEME.primary, ...PRIMARY_SWATCHES, ...SIDEBAR_SWATCHES, '#ffffff', '#000000'])];
for (const mode of ['light', 'dark']) {
  for (const color of colors) {
    parent.respond({ primary: color, header: color, sidebar: color, mode });
    await parent.service.refreshForParent();
    assert.equal(p('color-scheme'), mode);
    assert.equal(p('--skoolo-header-bg'), color);
    assert.equal(p('--skoolo-nav-bg'), color);
    contrast(p('--ion-color-primary-contrast'), color, 'Button / message text');
    contrast(p('--skoolo-header-ink'), color, 'Header');
    contrast(p('--skoolo-nav-ink'), color, 'Navigation label');
    contrast(p('--skoolo-nav-active-ink'), p('--skoolo-nav-active'), 'Active navigation icon');
    for (const surface of [p('--ion-background-color'), p('--skoolo-surface'), p('--skoolo-surface-2'),
      blend(p('--skoolo-surface'), color, mode === 'dark' ? .18 : .09)]) {
      contrast(p('--skoolo-brand-ink'), surface, 'Accent text');
      contrast(p('--skoolo-title'), surface, 'Main text');
      contrast(p('--skoolo-muted'), surface, 'Muted text');
    }
    for (const name of ['success', 'warning', 'danger']) {
      const ink = p(`--ion-color-${name}${name === 'success' ? '-shade' : ''}`);
      contrast(ink, blend(p('--skoolo-surface'), p(`--ion-color-${name}`), .12), `${name} status`);
    }
  }
}
parent.respond(custom);
await parent.service.refreshForParent();
const restored = parentFixture({ storage: parent.storage });
assert.equal(restored.properties.get('color-scheme'), 'dark');
assert.equal(restored.properties.get('--skoolo-header-bg'), custom.header);
assert.equal(restored.properties.get('--skoolo-nav-bg'), custom.sidebar);
parent.respond(new Error('Offline'));
await parent.service.refreshForParent();
assert.equal(p('--skoolo-header-bg'), custom.header, 'Offline refresh keeps saved appearance');

// Older requests, including those finishing after sign-out, cannot restore old branding.
const old = deferred();
parent.respond(old.promise);
const pending = parent.service.refreshForParent();
parent.respond({ ...DEFAULT_THEME, primary: '#00ada3' });
await parent.service.refreshForParent();
old.resolve(custom); await pending;
assert.equal(p('--ion-color-primary'), '#00ada3');
const logout = deferred();
parent.respond(logout.promise);
const late = parent.service.refreshForParent();
parent.service.reset();
logout.resolve(custom); await late;
assert.equal(p('color-scheme'), 'light');
assert.equal(p('--skoolo-header-bg'), DEFAULT_THEME.header);
assert.equal(p('--skoolo-nav-bg'), DEFAULT_THEME.sidebar);
assert.equal(p('--ion-background-color'), '#e9edf2');
assert.deepEqual(JSON.parse(parent.storage.get('skoolo-app-theme')), DEFAULT_THEME);
parent.respond(null); await parent.service.refreshForParent();
assert.equal(p('--ion-color-primary'), DEFAULT_THEME.primary);

const legacy = parentFixture({ storage: new Map([['skoolo-app-primary', '#00ada3']]) });
assert.equal(legacy.properties.get('--ion-color-primary'), '#00ada3');
assert.equal(legacy.storage.has('skoolo-app-primary'), false);
const corrupt = parentFixture({ storage: new Map([['skoolo-app-theme', '{broken']]) });
assert.equal(corrupt.properties.get('--ion-color-primary'), DEFAULT_THEME.primary);
const blockedStorage = new Map();
blockedStorage.get = blockedStorage.set = blockedStorage.delete = () => { throw new Error('Storage disabled'); };
const blocked = parentFixture({ storage: blockedStorage });
blocked.respond(custom); await blocked.service.refreshForParent();
assert.equal(blocked.properties.get('color-scheme'), 'dark');

// Visible polling/resume, in-flight de-duplication, and listener/timer disposal.
const watcher = parentFixture();
watcher.respond(custom);
const stop = watcher.service.watchForParent();
await flush();
assert.equal(watcher.calls(), 1);
watcher.tick(); await flush();
assert.equal(watcher.calls(), 2);
watcher.doc.visibilityState = 'hidden';
watcher.tick(); watcher.view.dispatchEvent(new Event('focus')); await flush();
assert.equal(watcher.calls(), 2, 'Hidden app does not poll');
watcher.doc.visibilityState = 'visible';
watcher.doc.dispatchEvent(new Event('visibilitychange')); await flush();
assert.equal(watcher.calls(), 3);
const inflight = deferred(); watcher.respond(inflight.promise);
watcher.view.dispatchEvent(new Event('focus')); watcher.tick();
watcher.doc.dispatchEvent(new Event('visibilitychange'));
assert.equal(watcher.calls(), 4, 'Focus and timer do not duplicate a pending lookup');
stop(); watcher.service.reset(); inflight.resolve(custom); await flush();
assert.equal(watcher.properties.get('color-scheme'), 'light');
assert.equal(watcher.intervals.size, 0);
watcher.view.dispatchEvent(new Event('focus')); watcher.doc.dispatchEvent(new Event('visibilitychange')); watcher.tick();
assert.equal(watcher.calls(), 4, 'Sign-out removes refresh listeners and interval');
watcher.respond(custom);
const stopAgain = watcher.service.watchForParent(); await flush();
assert.equal(watcher.properties.get('color-scheme'), 'dark', 'Next signed-in session restarts refresh');
stopAgain();
for (const fixture of [parent, restored, legacy, corrupt, blocked, watcher]) fixture.injector.destroy();
dbInjector.destroy(); portalInjector.destroy();
console.log(`School theme sync passed: full save/read, ${colors.length} palettes in both modes, contrast, cache migration, offline, stale requests, reset and foreground lifecycle.`);
