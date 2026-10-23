// Pure presentation checks; no browser, Supabase connection or school records required.
import '@angular/compiler';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { Injector, computed, runInInjectionContext, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const root = fileURLToPath(new URL('../', import.meta.url));
async function loadSource(relative, name) {
  const source = await readFile(path.join(root, relative), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, experimentalDecorators: true,
  }});
  const output = path.join(root, '.angular', 'presentation-checks', `${name}.mjs`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, outputText.replaceAll('./theme.model', './theme-model.mjs').replaceAll('./theme-colors', './theme-colors.mjs'));
  return import(pathToFileURL(output).href);
}

await loadSource('projects/shared/src/lib/theme/theme.model.ts', 'theme-model');
await loadSource('projects/shared/src/lib/theme/theme-colors.ts', 'theme-colors');
const { ThemeService, DEFAULT_THEME, PRIMARY_SWATCHES, SIDEBAR_SWATCHES } = await loadSource(
  'projects/shared/src/lib/theme/theme.service.ts', 'theme');
const properties = new Map();
const storage = new Map();
const document = {
  documentElement: { style: {
    setProperty: (key, value) => properties.set(key, value),
    removeProperty: key => properties.delete(key),
  }},
  defaultView: { localStorage: {
    getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
  }},
};
const injector = Injector.create({ providers: [{ provide: DOCUMENT, useValue: document }] });
const theme = runInInjectionContext(injector, () => new ThemeService());
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function checkContrast(a, b, minimum, description) {
  const x = luminance(a), y = luminance(b);
  const ratio = (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  assert.ok(ratio >= minimum, `${description}: ${a} on ${b} is ${ratio.toFixed(2)}:1`);
}
const colors = [...new Set([DEFAULT_THEME.primary, ...PRIMARY_SWATCHES, '#ffffff', '#000000'])];
for (const mode of ['light', 'dark']) {
  for (const primary of colors) {
    theme.preview({ primary, mode });
    checkContrast(properties.get('--brand-contrast'), primary, 4.5, 'Primary button');
    checkContrast(properties.get('--brand-hover-contrast'), properties.get('--brand-dark'), 4.5, 'Button hover');
    checkContrast(properties.get('--brand-ink'), mode === 'light' ? '#ffffff' : '#20223c', 5, 'Brand text');
  }
}
for (const color of [...colors, ...SIDEBAR_SWATCHES]) {
  theme.preview({ header: color, sidebar: color });
  checkContrast(properties.get('--header-ink'), color, 4.5, 'Header text');
  checkContrast(properties.get('--sidebar-ink'), color, 4.5, 'Sidebar text');
  checkContrast(properties.get('--sidebar-ink-hover'), color, 4.5, 'Sidebar hover');
  checkContrast(properties.get('--sidebar-active-ink'), properties.get('--sidebar-active'), 4.5, 'Selected sidebar item');
}
theme.preview({ mode: 'dark' });
checkContrast(properties.get('--ink'), properties.get('--surface-2'), 4.5, 'Disabled report input');
theme.resetPreview();
assert.equal(properties.has('--surface-2'), false, 'Light mode clears dark surface overrides');
assert.equal(properties.has('--table-head'), false, 'Light mode clears dark table headings');
assert.equal(properties.get('--brand'), DEFAULT_THEME.primary, 'Cancel restores the saved theme');
assert.deepEqual(theme.normalize({ primary: 'red', header: null, sidebar: '#fff', mode: 'invalid' }), DEFAULT_THEME);
theme.applyFromSchool({ theme: { ...DEFAULT_THEME, primary: '#fb7d5b', mode: 'dark' } });
theme.preview({ primary: '#000000' });
theme.resetPreview();
assert.equal(properties.get('--brand'), '#fb7d5b', 'Cancel preserves school branding');
const restored = runInInjectionContext(injector, () => new ThemeService());
assert.equal(restored.current().primary, '#fb7d5b', 'Saved theme survives a reload');
injector.destroy();
console.log(`Portal theme checks passed: ${colors.length} accents in light/dark mode, header/sidebar contrast, reset and cache.`);

const { TablePagination } = await loadSource('projects/school-portal/src/app/ui/table-pagination.ts', 'pagination');
const records = Object.freeze(Array.from({ length: 71 }, (_, i) => i + 1));
const rows = signal(records);
const filter = signal('all');
const filtered = computed(() => filter() === 'even' ? rows().filter(n => n % 2 === 0) : rows());
const pagination = new TablePagination(filtered, filter);
assert.equal(pagination.total(), 71);
assert.equal(pagination.pageCount(), 3);
assert.deepEqual(pagination.visible(), records.slice(0, 25));
pagination.goTo(3);
assert.deepEqual(pagination.visible(), records.slice(50));
assert.equal(pagination.end(), 71, 'Partial last page ends at the actual count');
rows.set(records.slice(0, 30));
assert.equal(pagination.page(), 2, 'Deleting rows clamps the page');
assert.deepEqual(pagination.visible(), [26, 27, 28, 29, 30]);
filter.set('even');
assert.equal(pagination.page(), 1, 'Changing filters resets the page');
assert.equal(pagination.total(), 15);
assert.equal(pagination.visible()[0], 2, 'Filter is applied before paging');
rows.set(records);
pagination.goTo(2);
pagination.resize(10);
assert.equal(pagination.page(), 1, 'Changing page size resets the page');
assert.deepEqual(pagination.visible(), [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
pagination.resize(0);
assert.equal(pagination.pageSize(), 10, 'Unsupported sizes cannot break page calculations');
pagination.goTo(-5);
assert.equal(pagination.page(), 1);
pagination.goTo(999);
assert.equal(pagination.page(), 4);
pagination.goTo(NaN);
assert.equal(pagination.page(), 4);
rows.set([]);
assert.equal(pagination.page(), 1);
assert.equal(pagination.start(), 0);
assert.equal(pagination.end(), 0);
assert.deepEqual(pagination.visible(), []);
assert.equal(records.length, 71, 'Paging does not mutate the source used by full-register exports');
console.log('Portal pagination checks passed: page boundaries, deletion, filter reset, page sizes, empty results and immutable source.');
