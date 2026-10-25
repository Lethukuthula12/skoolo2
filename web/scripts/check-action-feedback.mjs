import '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createEnvironmentInjector, runInInjectionContext, signal, ɵChangeDetectionScheduler, ɵEffectScheduler } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular/feedback-checks/feedback.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `export { ActionFeedbackService, ActionFeedbackComponent, AuthService, StaffService } from './projects/shared/src/public-api';
    export { AssessmentsPage } from './projects/school-portal/src/app/features/assessments/assessments.page';
    export { ReportsPage } from './projects/school-portal/src/app/features/reports/reports.page';`, resolveDir: root, sourcefile: 'feedback-check.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', tsconfig: path.join(root, 'tsconfig.json'),
});
const { ActionFeedbackService, ActionFeedbackComponent, AuthService, StaffService, AssessmentsPage, ReportsPage } = await import(pathToFileURL(output).href);
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout, originalNow = Date.now;
let now = 0, timerId = 0;
const timers = new Map();
globalThis.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
Date.now = () => now;
globalThis.document = new EventTarget(); document.hidden = false;
const advance = milliseconds => {
  const target = now + milliseconds;
  while (true) {
    const next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    now = next[1].at; timers.delete(next[0]); next[1].callback();
  }
  now = target;
};
const effects = new Set(), events = new Subject(), invalidated = new Subject();
const user = signal({ id: 'user-a' }), school = signal('school-a'), boundary = signal(null);
const router = { url: '/documents', events, getCurrentNavigation: () => null };
const injector = createEnvironmentInjector([
  { provide: AuthService, useValue: { user, boundary, stateInvalidated: invalidated } },
  { provide: StaffService, useValue: { currentSchoolId: school } },
  { provide: Router, useValue: router },
  { provide: ActionFeedbackService, useFactory: () => new ActionFeedbackService() },
  { provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
  { provide: ɵEffectScheduler, useValue: { add: e => effects.add(e), schedule: e => effects.add(e), remove: e => effects.delete(e) } },
]);
const feedback = injector.get(ActionFeedbackService);
const flush = () => { for (const effect of effects) if (effect.dirty) effect.run(); };
flush();
const source = feedback.source();
feedback.show(source, 'pending', 'Saving draft…');
advance(60000); assert.equal(feedback.notices()[0].kind, 'pending');
feedback.show(source, 'success', 'Draft saved.');
assert.equal(feedback.notices().length, 1, 'Pending should become one result card');
advance(2000); feedback.pause(source.id, 'pointer');
advance(60000); assert.equal(feedback.notices()[0].leaving, false, 'Hover pauses dismissal');
feedback.pause(source.id, 'focus'); feedback.resume(source.id, 'pointer');
advance(60000); assert.equal(feedback.notices()[0].leaving, false, 'Keyboard focus also keeps it visible');
feedback.resume(source.id, 'focus'); advance(3999); assert.equal(feedback.notices()[0].leaving, false);
advance(1); assert.equal(feedback.notices()[0].leaving, true); advance(180); assert.equal(feedback.notices().length, 0);
feedback.show(source, 'success', 'Draft saved.');
document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
advance(60000); assert.equal(feedback.notices().length, 1);
document.hidden = false; document.dispatchEvent(new Event('visibilitychange'));
advance(6180); assert.equal(feedback.notices().length, 0);
feedback.show(source, 'error', 'Could not save. Please try again.');
advance(600000); assert.equal(feedback.notices()[0].kind, 'error', 'Errors require dismissal or another action');
feedback.dismiss(source.id); feedback.show(source, 'success', 'Saved on retry.');
advance(180); assert.equal(feedback.notices()[0].message, 'Saved on retry.', 'An old exit timer cannot remove a newer outcome');
feedback.clear();
for (let index = 0; index < 5; index++) feedback.show(feedback.source(), 'success', `Saved ${index}`);
assert.equal(feedback.notices().length, 3); assert.equal(timers.size, 3);
feedback.clear(); assert.equal(timers.size, 0);

const rootOutlet = feedback.outletId(), drawerOutlet = feedback.outletId();
feedback.setOutlet(drawerOutlet, true, 1); feedback.setOutlet(rootOutlet, true, 0);
assert.equal(feedback.activeOutlet(), drawerOutlet, 'A native modal must own the visible feedback');
feedback.setOutlet(drawerOutlet, false, 1); assert.equal(feedback.activeOutlet(), rootOutlet);

feedback.show(source, 'success', 'Private school result');
user.set({ id: 'user-a' }); flush(); assert.equal(feedback.notices().length, 1, 'Token refresh must not hide the result');
user.set({ id: 'user-b' }); flush(); assert.equal(feedback.notices().length, 0);
feedback.show(source, 'success', 'Stale response'); assert.equal(feedback.notices().length, 0);
user.set({ id: 'user-a' }); flush();
school.set('school-b'); flush(); feedback.show(source, 'error', 'Old school error'); assert.equal(feedback.notices().length, 0);
school.set('school-a'); flush();
feedback.show(source, 'pending', 'Saving…'); invalidated.next(); assert.equal(feedback.notices().length, 0);
boundary.set('signed-out'); feedback.show(source, 'success', 'Late save'); assert.equal(feedback.notices().length, 0); boundary.set(null);
events.next(new NavigationStart(1, '/reports')); feedback.show(source, 'success', 'Old page result'); assert.equal(feedback.notices().length, 0);
events.next(new NavigationCancel(1, '/reports', 'cancelled'));
feedback.show(source, 'success', 'Back on original page'); assert.equal(feedback.notices().length, 1);
events.next(new NavigationStart(2, '/reports')); router.url = '/reports'; events.next(new NavigationEnd(2, '/reports', '/reports'));
feedback.show(source, 'error', 'Hidden cached-page error'); assert.equal(feedback.notices().length, 0);

// Real binding component: loading alone must never manufacture a success, and repeated saves work.
const bridge = runInInjectionContext(injector, () => new ActionFeedbackComponent());
bridge.success = signal(''); bridge.error = signal(''); bridge.pending = signal(false); bridge.pendingText = signal('Saving…');
flush(); bridge.pending.set(true); flush(); assert.equal(feedback.notices()[0].kind, 'pending');
bridge.pending.set(false); flush(); assert.equal(feedback.notices().length, 0);
bridge.pending.set(true); flush(); bridge.success.set('Saved.'); bridge.pending.set(false); flush();
assert.equal(feedback.notices()[0].kind, 'success'); advance(6180);
bridge.pending.set(true); bridge.success.set(''); flush(); bridge.success.set('Saved.'); bridge.pending.set(false); flush();
assert.equal(feedback.notices()[0].kind, 'success', 'The same success text must appear again for another save');
bridge.pending.set(true); flush(); bridge.pending.set(false); flush();
assert.equal(feedback.notices().length, 0, 'A refresh retaining an old notice must not replay it as a new save');
bridge.pending.set(true); bridge.success.set(''); flush(); bridge.error.set('Network unavailable'); bridge.pending.set(false); flush();
assert.equal(feedback.notices()[0].kind, 'error');
injector.destroy(); assert.equal(feedback.notices().length, 0); assert.equal(timers.size, 0);

// Multiple score/report writes stay pending until every request settles, including failures.
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const requests = [deferred(), deferred()]; let index = 0;
const scores = Object.assign(Object.create(AssessmentsPage.prototype), { savingScores: signal(0), scores: signal({}), error: signal(null), notice: signal(null), staff: { saveAssessmentScore: () => requests[index++].promise } });
const first = scores.onScore({ id: 'assessment', max_score: 10 }, { id: 'one' }, '5');
const second = scores.onScore({ id: 'assessment', max_score: 10 }, { id: 'two' }, '7');
requests[0].resolve(); await first; assert.equal(scores.savingScores(), 1); assert.equal(scores.notice(), null);
requests[1].reject(new Error('Save failed')); await second; assert.equal(scores.savingScores(), 0); assert.equal(scores.notice(), null); assert.equal(scores.error(), 'Save failed');
const reports = Object.assign(Object.create(ReportsPage.prototype), { savingChanges: signal(0), error: signal(null), notice: signal(null) });
await reports.quietRun(async () => {}); assert.equal(reports.notice(), 'Report changes saved.');

const css = await readFile(path.join(root, 'projects/shared/src/lib/feedback/feedback-outlet.component.scss'), 'utf8');
assert.match(css, /:host\s*\{[^}]*position:\s*fixed/);
assert.match(css, /prefers-reduced-motion: reduce/); assert.match(css, /safe-area-inset-bottom/);
const outlet = await readFile(path.join(root, 'projects/shared/src/lib/feedback/feedback-outlet.component.ts'), 'utf8');
assert.match(outlet, /'alert' : 'status'/); assert.match(outlet, /aria-label="Dismiss notification"/);
assert.ok(!outlet.includes('innerHTML'), 'Feedback must remain escaped text');
globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout; Date.now = originalNow;
console.log('Action feedback passed: result transitions, repeated saves, no false success, timing/pause/dismissal, modal ownership, navigation/account cleanup, concurrent save failures and accessibility contracts.');
