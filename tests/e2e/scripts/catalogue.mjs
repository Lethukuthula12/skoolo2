import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateMessages } from '@cucumber/gherkin';
import { IdGenerator, SourceMediaType } from '@cucumber/messages';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(project, '../..');
const check = process.argv.includes('--check');
const cases = [], seen = new Set(), modules = [];
async function walk(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(file));
    else if (entry.name.endsWith('.feature')) paths.push(file);
  }
  return paths.sort();
}
const definitions = await readFile(path.join(project, 'step-definitions/local.steps.ts'), 'utf8');
const patterns = [...definitions.matchAll(/(?:Given|When|Then)\('([^']+)'/g)].map(m => {
  const escaped = m[1].replace(/[.*+?^$()|[\]\\]/g, '\\$&').replaceAll('{string}', '"[^"]*"');
  return new RegExp('^' + escaped + '$');
});
for (const file of await walk(path.join(project, 'features'))) {
  const source = await readFile(file, 'utf8');
  const uri = path.relative(root, file).replaceAll('\\', '/');
  const envelopes = generateMessages(source, uri, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN,
    { includeGherkinDocument: true, includePickles: true, newId: IdGenerator.incrementing() });
  const errors = envelopes.filter(e => e.parseError);
  if (errors.length) throw new Error(uri + ': ' + errors.map(e => e.parseError.message).join('; '));
  const feature = envelopes.find(e => e.gherkinDocument)?.gherkinDocument.feature;
  if (!feature) throw new Error('Missing Feature: ' + uri);
  const featureCases = [];
  for (const child of feature.children) {
    if (!child.scenario) throw new Error('Use explicit scenarios in the handover catalogue: ' + uri);
    const scenario = child.scenario;
    const tags = [...feature.tags, ...scenario.tags].map(t => t.name);
    const ids = tags.filter(t => /^@TC_[A-Z0-9_]+$/.test(t));
    if (ids.length !== 1 || seen.has(ids[0])) throw new Error('Missing or duplicate test ID in ' + uri + ': ' + scenario.name);
    seen.add(ids[0]);
    if (!tags.some(t => ['@P0', '@P1', '@P2'].includes(t))) throw new Error('Missing priority: ' + ids[0]);
    if (tags.includes('@manual') === tags.includes('@automated')) throw new Error('Choose manual OR automated: ' + ids[0]);
    const automated = tags.includes('@automated');
    if (automated !== uri.includes('/automated/')) throw new Error('Wrong folder for automation state: ' + ids[0]);
    if (!scenario.steps.some(s => s.keyword.trim() === 'Then')) throw new Error('Missing expected result: ' + ids[0]);
    if (automated) for (const step of scenario.steps) {
      if (!patterns.some(re => re.test(step.text))) throw new Error('Undefined automated step: ' + step.text);
    }
    const item = { id: ids[0].slice(1), name: scenario.name, feature: feature.name, uri,
      mode: tags.includes('@planned') ? 'Planned requirement' : automated ? 'Automated - execution pending' : 'Manual',
      priority: tags.find(t => /^@P[012]$/.test(t)).slice(1), steps: scenario.steps };
    cases.push(item); featureCases.push(item);
  }
  modules.push({ title: feature.name, uri, count: featureCases.length, mode: featureCases[0]?.mode });
}
if (modules.length < 20 || cases.length < 100) throw new Error('Unexpected loss of module coverage.');
const automated = cases.filter(c => c.mode.startsWith('Automated')).length;
let coverage = '# Test coverage catalogue\n\nGenerated from the Gherkin files. Run `npm run e2e:catalogue` after editing scenarios.\n\n';
coverage += cases.length + ' scenarios: ' + automated + ' automated definitions, ' + (cases.length - automated - cases.filter(c => c.mode.startsWith('Planned')).length) + ' manual cases, ' + cases.filter(c => c.mode.startsWith('Planned')).length + ' planned requirements. Definitions are not evidence of a passing run.\n\n';
coverage += '| Module | Cases | Execution mode | Source |\n|---|---:|---|---|\n';
for (const m of modules) coverage += '| ' + m.title + ' | ' + m.count + ' | ' + m.mode + ' | [Feature](../../' + m.uri + ') |\n';
coverage += '\nThe complete journeys are in [journeys.feature](../../tests/e2e/features/catalogue/journeys.feature). Run records must identify commit, date, device, result and evidence. Manual cases are excluded from the Cypress run pattern and never silently counted as automated passes.\n';
let manual = '# Manual test cases\n\nGenerated from the same Gherkin scenarios used for coverage. Start with [new laptop setup](new-laptop.md). Each Given describes preparation; the When is the action and the Then is the expected result. Reset before a fresh test session. Automated cases can also be followed manually.\n\n';
manual += 'For each case record: commit, tester, date, device/browser, actual result, Passed / Failed / Blocked / Not run, evidence and issue link. Copy this document for an execution record; do not overwrite the generated source with results.\n\n';
for (const c of cases) {
  manual += '## ' + c.id + ' ' + c.name + '\n\n' + c.priority + ' | ' + c.mode + ' | ' + c.feature + '\n\n';
  c.steps.forEach((s,i) => { manual += (i+1) + '. **' + s.keyword.trim() + '** ' + s.text + '\n'; });
  manual += '\nResult: Not run. Evidence: —\n\n';
}
const outputs = { 'coverage-matrix.md': coverage, 'manual-test-cases.md': manual.trimEnd() + '\n' };
await mkdir(path.join(root, 'docs/testing'), { recursive: true });
for (const [name, value] of Object.entries(outputs)) {
  const target = path.join(root, 'docs/testing', name);
  if (check) {
    if ((await readFile(target, 'utf8').catch(() => '')).replaceAll('\r\n', '\n') !== value) throw new Error('Regenerate stale guide: npm run e2e:catalogue (' + name + ')');
  } else await writeFile(target, value);
}
console.log('Validated ' + cases.length + ' scenarios in ' + modules.length + ' features; ' + automated + ' have matching automation definitions.');
