// Exercise the shipped renderer and editor workflow without credentials or production writes.
import '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { parse } from 'parse5';
import { signal, createEnvironmentInjector, runInInjectionContext, ɵChangeDetectionScheduler, ɵEffectScheduler } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular/paper-checks/papers.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `export * from './projects/school-portal/src/app/features/papers/paper-print';
    export * from './projects/school-portal/src/app/features/papers/paper.model';
    export * from './projects/school-portal/src/app/features/papers/papers.page';
    export * from './projects/school-portal/src/app/features/papers/paper.service';
    export { AuthService, StaffService } from './projects/shared/src/public-api';`, resolveDir: root, sourcefile: 'paper-check.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', tsconfig: path.join(root, 'tsconfig.json'),
});
const { paperPrintHtml, printPaper, blankQuestion, questionTotal, rasterImage, PapersPage, PaperService, AuthService, StaffService } = await import(pathToFileURL(output).href);
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4ZkAAAAASUVORK5CYII=';
const secret = 'CONFIDENTIAL_MEMO_ANSWER_42';
const paper = {
  id: 'paper-a', title: 'Mathematics', status: 'approved', revision: 3, total_marks: 10, term_number: 1,
  duration_minutes: 60, assessed_on: '2027-03-01', instructions: 'Show your working.', footer: 'End of paper.',
  display_context: { school_name: 'Example School', subject_name: 'Maths', class_name: 'G4 A', academic_year: 2027, badge_url: 'javascript:alert(1)' },
  questions: [
    { ...blankQuestion('section'), text: 'Section A' },
    { ...blankQuestion('short'), text: '2 + 2?', marks: 2, answer: secret },
    { ...blankQuestion('choice'), text: 'Select one', marks: 2, options: 'First\nSecond', answer: secret },
    { ...blankQuestion('page_break') },
    { ...blankQuestion('image'), text: 'Describe the image', marks: 3, image: pixel, answer: secret },
    { ...blankQuestion('table'), text: 'Complete the table', marks: 3, cells: 'Item | Total\nApples |', answer: secret },
  ],
};
assert.equal(questionTotal(paper.questions), 10);
const learner = paperPrintHtml(paper, false);
const memo = paperPrintHtml(paper, true);
assert.ok(!learner.includes(secret), 'Learner output must contain no answer data, even hidden');
assert.ok(memo.includes(secret));
assert.ok(memo.includes('MEMORANDUM — STAFF ONLY'));
assert.ok(!memo.includes('Name: ____'));
assert.ok(!memo.includes('<img class="question-image"'));
assert.match(learner, /4\. Complete the table/);
assert.ok(learner.includes('break-before:page'));
assert.ok(learner.includes('<table>'));
assert.ok(learner.includes('<ol type="A">'));
assert.ok(!learner.includes('javascript:'));
assert.ok(paperPrintHtml({ ...paper, status: 'draft' }, false).includes('DRAFT — NOT APPROVED'));
assert.ok(!learner.includes('DRAFT — NOT APPROVED'));
assert.equal(rasterImage('data:image/svg+xml;base64,AAAA'), null);
assert.equal(rasterImage('https://example.test/private-test.png'), null);
assert.equal(rasterImage(pixel), pixel);
assert.equal(rasterImage(`data:image/png;base64,${'A'.repeat(1400000)}`), null);

const descendants = node => [node, ...(node.childNodes ?? []).flatMap(descendants)];
for (const attack of ['</title><script>alert(1)</script>', '<img src=x onerror=alert(1)>', '" onload="alert(1)', '<iframe srcdoc="bad"></iframe>', 'IsiZulu & English — ½']) {
  for (const memorandum of [false, true]) {
    const html = paperPrintHtml({ ...paper, title: attack, footer: attack, instructions: attack,
      display_context: { ...paper.display_context, school_name: attack },
      questions: [{ ...blankQuestion('table'), text: attack, cells: attack, options: attack, answer: attack, image: attack }],
    }, memorandum);
    const nodes = descendants(parse(html));
    for (const node of nodes.filter(n => n.tagName)) {
      assert.ok(!['script', 'iframe', 'object', 'embed', 'form', 'svg'].includes(node.tagName));
      assert.ok(!node.attrs.some(a => /^on/i.test(a.name) || a.name === 'srcdoc'));
    }
    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<title>'));
  }
}

// A blocked popup or broken image must not silently produce a partial examination paper.
globalThis.window = { open: () => null };
await assert.rejects(printPaper(paper, false), /pop-ups/);
let didPrint = false, closed = false;
const popup = { opener: {}, document: { write() {}, close() {}, images: [{ decode: async () => { throw new Error('broken image'); } }] }, focus() {}, print() { didPrint = true; }, close() { closed = true; } };
window.open = () => popup;
await assert.rejects(printPaper(paper, false), /image could not load/);
assert.equal(didPrint, false); assert.equal(closed, true); assert.equal(popup.opener, null);
popup.document.images = [{ decode: async () => {} }];
await printPaper(paper, true);
assert.equal(didPrint, true);

// Real controller save path: failures preserve edits; stale session results never repopulate UI.
function editor(save) {
  const controller = Object.create(PapersPage.prototype);
  Object.assign(controller, {
    epoch: 1, busy: signal(false), error: signal(''), notice: signal(''), paper: signal(null), papers: signal([]),
    service: { save }, form: { dirty: true, invalid: false, controls: { title: { value: 'Paper' } },
      markAllAsTouched() {}, getRawValue() { return { title: 'Paper' }; }, markAsPristine() { this.dirty = false; } },
  });
  return controller;
}
const failure = editor(async () => { throw new Error('Network unavailable'); });
await failure.save();
assert.equal(failure.form.dirty, true); assert.equal(failure.paper(), null); assert.equal(failure.error(), 'Network unavailable');
const success = editor(async () => paper);
await success.save();
assert.equal(success.form.dirty, false); assert.equal(success.paper().id, paper.id);
let finish;
const stale = editor(() => new Promise(resolve => { finish = resolve; }));
const saving = stale.save(); stale.epoch++; finish(paper); await saving;
assert.equal(stale.paper(), null); assert.equal(stale.form.dirty, true);
const conflict = editor(async () => { throw new Error('This paper changed in another window. Reload before editing.'); });
await conflict.save(); assert.equal(conflict.form.dirty, true); assert.match(conflict.error(), /another window/);

// Instantiate the real reactive-form controller. Only network/session dependencies are substituted.
const effects = new Set();
const school = signal('school-a');
const author = signal({ id: 'teacher-a' });
const savedPapers = new Map();
const mockService = {
  list: async () => [...savedPapers.values()],
  options: async () => [{ class_id: 'class-a', subject_id: 'subject-a', class_name: 'A', grade_code: 'G4', academic_year: 2027, subject_name: 'Maths' }],
  reviewers: async () => [{ user_id: 'admin-a', full_name: 'Principal' }],
  templates: async () => [], history: async () => [],
  save: async (existing, content) => {
    const saved = { ...paper, ...content, id: existing?.id ?? 'new-paper', status: 'draft', author_id: 'teacher-a', revision: (existing?.revision ?? 0) + 1, total_marks: questionTotal(content.questions) };
    savedPapers.set(saved.id, saved); return saved;
  },
  get: async id => savedPapers.get(id),
  transition: async (existing, action) => ({ ...existing, status: action === 'submit' ? 'in_review' : 'draft', revision: existing.revision + 1 }),
};
const injector = createEnvironmentInjector([
  { provide: FormBuilder, useValue: new FormBuilder() },
  { provide: StaffService, useValue: { currentSchoolId: school, isAdmin: () => false, currentSchool: () => ({ name: 'Example School' }), assessments: async () => [] } },
  { provide: AuthService, useValue: { user: author } },
  { provide: PaperService, useValue: mockService },
  { provide: DomSanitizer, useValue: { bypassSecurityTrustHtml: html => html } },
  { provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
  { provide: ɵEffectScheduler, useValue: { add: effect => effects.add(effect), schedule: effect => effects.add(effect), remove: effect => effects.delete(effect) } },
]);
const realEditor = runInInjectionContext(injector, () => new PapersPage());
for (const effect of effects) if (effect.dirty) effect.run();
await new Promise(resolve => setImmediate(resolve));
assert.equal(realEditor.options().length, 1);
realEditor.start();
realEditor.form.controls.title.setValue('My test');
realEditor.questions.at(0).patchValue({ text: 'First question', marks: 2, answer: secret });
realEditor.addBlock('long');
realEditor.questions.at(1).patchValue({ text: 'Second question', marks: 3 });
realEditor.moveBlock(1, -1);
assert.equal(realEditor.content().questions[0].text, 'Second question');
assert.equal(realEditor.total(), 5);
await realEditor.save();
assert.equal(realEditor.paper().total_marks, 5);
assert.equal(realEditor.form.dirty, false);
realEditor.back();
await realEditor.open('new-paper');
assert.equal(realEditor.questions.length, 2);
assert.equal(realEditor.content().questions[1].answer, secret);
assert.equal(realEditor.form.valid, true);
await realEditor.transition('submit');
assert.equal(realEditor.canEdit(), false);
assert.equal(realEditor.paper().status, 'in_review');
assert.ok(!realEditor.preview().includes(secret));
realEditor.memorandum.set(true);
assert.ok(realEditor.preview().includes(secret));
await realEditor.transition('withdraw');
assert.equal(realEditor.canEdit(), true);
school.set('school-b');
for (const effect of effects) if (effect.dirty) effect.run();
assert.equal(realEditor.editing(), false);
assert.equal(realEditor.paper(), null);
assert.equal(realEditor.questions.length, 0);
injector.destroy();

console.log('Assessment papers: real form save/reopen/review flow, school-switch cleanup, print separation, hostile content, image failures, save conflicts and stale session results passed.');
