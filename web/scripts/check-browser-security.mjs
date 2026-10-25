// Exercise the actual print/import controllers with synthetic data; never contact Supabase.
import '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { signal } from '@angular/core';
import { build } from 'esbuild';
import { parse } from 'parse5';
import * as XLSX from 'xlsx';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular/security-checks/printing.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `
    export { ReportsPage } from './projects/school-portal/src/app/features/reports/reports.page';
    export { LearnersPage } from './projects/school-portal/src/app/features/learners/learners.page';
    export { printImageUrl, openPrintDocument } from './projects/school-portal/src/app/ui/print-document';
    export { ACHIEVEMENT_LEVELS } from './projects/shared/src/public-api';
  `, resolveDir: root, sourcefile: 'security-check.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: path.join(root, 'tsconfig.json'),
});
const { ReportsPage, LearnersPage, printImageUrl, openPrintDocument, ACHIEVEMENT_LEVELS } = await import(pathToFileURL(output).href);

let printed, popup;
globalThis.window = { open: () => {
  popup = { opener: {}, document: { write: html => { printed = html; }, close() {} }, focus() {}, print() {} };
  return popup;
} };
const descendants = node => [node, ...(node.childNodes ?? []).flatMap(descendants)];
const content = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(content).join('');
const attribute = (node, name) => node.attrs?.find(attr => attr.name === name)?.value;
function inspectPrint(expectedText, expectedImages) {
  const nodes = descendants(parse(printed));
  const allowed = new Set(['html', 'head', 'meta', 'title', 'style', 'body', 'div', 'h1', 'h2', 'p', 'strong', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img']);
  for (const node of nodes.filter(node => node.tagName)) {
    assert.ok(allowed.has(node.tagName), `Unexpected element: ${node.tagName}`);
    assert.equal(node.attrs.some(attr => /^on/i.test(attr.name) || ['srcdoc', 'formaction'].includes(attr.name)), false);
  }
  assert.equal(nodes.filter(node => node.tagName === 'img').length, expectedImages);
  assert.ok(nodes.some(node => node.tagName === 'h1' && content(node).includes(expectedText)), 'School names must round-trip as literal text');
  const policy = nodes.find(node => node.tagName === 'meta' && attribute(node, 'http-equiv') === 'Content-Security-Policy');
  assert.match(attribute(policy, 'content'), /default-src 'none'/);
  assert.match(attribute(policy, 'content'), /form-action 'none'/);
  assert.ok(printed.indexOf('Content-Security-Policy') < printed.indexOf('<title>'));
  assert.equal(popup.opener, null, 'Print windows must not retain the opener reference');
  return nodes;
}

const vectors = [
  `O'Brien & Sons <Community> "School"`,
  '</title><script>globalThis.printAttack=true</script><title>',
  '<img src=x onerror="globalThis.printAttack=true">',
  '\"><svg onload="globalThis.printAttack=true"><a href="javascript:void(0)">x</a></svg>',
  '</style><iframe srcdoc="<script>parent.printAttack=true</script>"></iframe>',
  '&lt;img src=x onerror=alert(1)&gt;',
  'IsiZulu — École • 学校',
];
for (const value of vectors) {
  const school = { name: value, tagline: value, stamp_url: 'https://images.example/stamp.png?label=" onerror="attack&x=1' };
  const cls = { name: value, grade_code: value };
  const learner = { first_name: value, last_name: value, date_of_birth: value, gender: value, identity_number: value };
  ReportsPage.prototype.printReport.call({
    staff: { currentSchool: () => school }, selectedClass: () => cls, levels: ACHIEVEMENT_LEVELS,
  }, {
    learner, term_number: value, academic_year: value, days_absent: value,
    teacher_comment: value, principal_comment: value,
    report_marks: [{ subjects: { name: value, sort_order: 1 }, mark: 75 }],
  });
  const report = inspectPrint(value, 1);
  assert.equal(report.filter(node => node.tagName === 'p' && content(node) === value).length, 2, 'Both comments remain literal text');
  assert.ok(report.some(node => node.tagName === 'td' && content(node) === value), 'Subject names remain literal text');
  const image = report.find(node => node.tagName === 'img');
  assert.equal(attribute(image, 'src'), new URL(school.stamp_url).href, 'Image attributes cannot break out of their quotes');
  assert.equal(attribute(image, 'referrerpolicy'), 'no-referrer');

  LearnersPage.prototype.printRoster.call({
    staff: { currentSchool: () => school }, selectedClass: () => cls, gradeLabelOf: () => value,
    year: () => value, roster: () => [learner],
  });
  const roster = inspectPrint(value, 0);
  assert.equal(roster.filter(node => node.tagName === 'td' && content(node) === value).length, 5, 'Every roster field remains text');
}
for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg onload="alert(1)"/>', 'http://images.example/a.png', '//images.example/a.png', 'file:///etc/passwd', 'https://user:password@images.example/a.png', 'not a URL', null]) {
  assert.equal(printImageUrl(url), null);
  ReportsPage.prototype.printReport.call({
    staff: { currentSchool: () => ({ name: 'Example School', stamp_url: url }) },
    selectedClass: () => null, levels: ACHIEVEMENT_LEVELS,
  }, { learner: null, report_marks: [], term_number: 1, academic_year: 2026 });
  inspectPrint('Example School', 0);
}
globalThis.window.open = () => null;
assert.doesNotThrow(() => openPrintDocument('<html></html>'), 'A blocked popup is handled');
delete globalThis.window;

// Use the same API sequence as exports and the real file-selection/import parser.
assert.equal(XLSX.version, '0.20.3');
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{
  'First name': 'Léa', Surname: "O'Brien", 'Date of birth': new Date(2018, 3, 12),
  Gender: 'Female', 'Admission number': '00042', Guardian: 'Example Parent', Phone: '0821234567',
}]), 'Class list');
XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ Subject: 'Mathematics', Mark: 75, Term: 1 }]), 'Schedule');
const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'buffer' });
const restored = XLSX.read(bytes, { type: 'buffer', cellDates: true });
assert.deepEqual(restored.SheetNames, ['Class list', 'Schedule']);
assert.deepEqual(XLSX.utils.sheet_to_json(restored.Sheets.Schedule), [{ Subject: 'Mathematics', Mark: 75, Term: 1 }]);
const importer = Object.create(LearnersPage.prototype);
importer.error = signal(null);
importer.importRows = signal([]);
importer.showImport = signal(false);
await importer.onFileChosen({ target: { files: [{ name: 'class-list.xlsx', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }] } });
assert.equal(importer.error(), null);
assert.equal(importer.showImport(), true);
assert.equal(importer.importRows()[0].error, null);
assert.equal(importer.importRows()[0].data.first_name, 'Léa');
assert.equal(importer.importRows()[0].data.last_name, "O'Brien");
assert.equal(importer.importRows()[0].data.date_of_birth, '2018-04-12');
assert.equal(importer.importRows()[0].data.admission_number, '00042');
await importer.onFileChosen({ target: { files: [{ name: 'class-list.csv', text: async () => 'First name,Surname,Date of birth\nLéa,"O\'Brien",12/04/2018' }] } });
assert.equal(importer.importRows()[0].error, null);
assert.equal(importer.importRows()[0].data.date_of_birth, '2018-04-12', 'CSV dates remain day-first');

for (const app of ['school-portal', 'parent-app']) {
  const headers = await readFile(path.join(root, `projects/${app}/public/_headers`), 'utf8');
  const lines = headers.split(/\r?\n/);
  assert.ok(lines.every(line => line.length < 2000), 'Stay within Cloudflare header limits');
  const globalRules = headers.split(/\/\*\r?\n/)[1]?.split(/\r?\n\/index.html/)[0];
  assert.ok(globalRules, 'Security headers apply to every route');
  assert.match(globalRules, /X-Content-Type-Options: nosniff/);
  assert.match(globalRules, /X-Frame-Options: DENY/);
  assert.match(globalRules, /Referrer-Policy: no-referrer/);
  const enforced = globalRules.match(/  Content-Security-Policy: (.*)/)[1];
  assert.match(enforced, /frame-ancestors 'none'/);
  assert.match(enforced, /object-src 'none'/);
  const proposed = globalRules.match(/Content-Security-Policy-Report-Only: (.*)/)[1];
  assert.match(proposed, /script-src 'self' https:\/\/challenges.cloudflare.com;/);
  assert.match(proposed, /frame-src https:\/\/challenges.cloudflare.com;/);
  assert.doesNotMatch(proposed, /unsafe-eval/);
  assert.match(proposed, /connect-src 'self' https:\/\/chfebhulyqawuhjbmlhw.supabase.co wss:\/\/chfebhulyqawuhjbmlhw.supabase.co;/);
  assert.match(headers, /\/index.html\s+Cache-Control: no-cache/);
}
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const parser = lock.packages['node_modules/xlsx'];
assert.equal(parser.version, '0.20.3');
assert.equal(parser.resolved, 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz');
assert.match(parser.integrity, /^sha512-/);
console.log('Browser security checks passed: print injection vectors, image URL restrictions, popup handling, XLSX/CSV import and workbook round-trip, headers and dependency integrity.');
