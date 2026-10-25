// Real services with synthetic SDK events/storage responses. No credentials or live requests.
import '@angular/compiler';
import { parseTemplate } from '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { build } from 'esbuild';
import { setMaxListeners } from 'node:events';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular/session-checks/services.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `
    export { AuthService, StaffService, SUPABASE_CLIENT, SessionEndedComponent } from './projects/shared/src/public-api';
    export { staffGuard } from './projects/shared/src/lib/staff/staff.guard';
    export { adminGuard } from './projects/shared/src/lib/staff/admin.guard';
  `, resolveDir: root, sourcefile: 'sessions.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: path.join(root, 'tsconfig.json'),
});
const { AuthService, StaffService, SUPABASE_CLIENT, SessionEndedComponent, staffGuard, adminGuard } = await import(pathToFileURL(output).href);
const pending = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const response = session => ({ data: { session }, error: null });
const originalNow = Date.now, originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
let now = originalNow(), timerId = 0;
const timers = new Map(), fixtures = [];
Date.now = () => now;
globalThis.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
// Several independent browser fixtures share these two event targets during this script.
setMaxListeners(0, window, document);
const session = (id = 'account-a') => ({ user: { id }, expires_at: Math.floor(now / 1000) + 3600, access_token: 'synthetic', refresh_token: 'synthetic' });
const rows = [{ role: 'admin', schools: { id: 'school-a' } }, { role: 'staff', schools: { id: 'school-b' } }];

function fixture(initial = session(), initialRead) {
  let callback;
  const state = { stored: initial, reads: [], rows, query: null, logoutError: null, logoutThrows: false, removeOnError: true, unsubscribed: false, logoutCalls: [] };
  const emit = (event, value) => { state.stored = value; callback(event, value); };
  const client = {
    auth: {
      getSession: () => initialRead ? (initialRead = null, initialReadPromise) : Promise.resolve(response(state.stored)),
      onAuthStateChange: listener => { callback = listener; return { data: { subscription: { unsubscribe: () => { state.unsubscribed = true; } } } }; },
      signOut: async options => {
        state.logoutCalls.push(options);
        if (state.logoutThrows) throw new Error('Network unavailable');
        if (!state.logoutError || state.removeOnError) emit('SIGNED_OUT', null);
        return { error: state.logoutError };
      },
    },
    from: table => ({ select: columns => ({ eq: (key, value) => {
      state.reads.push({ table, columns, key, value });
      return state.query ?? Promise.resolve({ data: state.rows, error: null });
    } }) }),
  };
  const initialReadPromise = initialRead;
  const injector = Injector.create({ providers: [
    { provide: SUPABASE_CLIENT, useValue: client },
    { provide: AuthService, useFactory: () => new AuthService() },
    { provide: StaffService, useFactory: () => new StaffService() },
    { provide: Router, useValue: { createUrlTree: commands => commands } },
  ] });
  const auth = injector.get(AuthService), staff = injector.get(StaffService);
  const panel = runInInjectionContext(injector, () => new SessionEndedComponent());
  const item = { injector, auth, staff, state, emit, panel };
  fixtures.push(item);
  return item;
}

try {
  const a = fixture();
  await a.auth.whenReady();
  await a.staff.loadSchools();
  assert.equal(a.auth.isSignedIn(), true);
  assert.equal(a.staff.isAdmin(), true);
  assert.deepEqual(a.state.reads[0], { table: 'school_staff', columns: 'school_id, role, schools(*)', key: 'user_id', value: 'account-a' });
  a.emit('PASSWORD_RECOVERY', session());
  assert.equal(a.auth.isPasswordRecovery(), true);
  a.emit('TOKEN_REFRESHED', session());
  assert.equal(a.auth.isPasswordRecovery(), true, 'Ordinary refresh preserves an active reset flow');
  assert.equal(a.auth.boundary(), null, 'Refresh does not discard a valid workspace');
  assert.equal(a.staff.memberships().length, 2);
  a.emit('SIGNED_OUT', null);
  assert.equal(a.auth.boundary(), 'session-ended');
  assert.equal(a.auth.isPasswordRecovery(), false);
  assert.equal(a.auth.user(), null);
  assert.equal(a.staff.currentSchoolId(), null);
  assert.equal(a.staff.isAdmin(), false);
  assert.deepEqual(a.staff.memberships(), []);
  a.emit('SIGNED_IN', session('account-b'));
  assert.equal(a.auth.isSignedIn(), false, 'Old page instances stay blocked until a full document load');
  assert.deepEqual(await a.staff.loadSchools(), []);

  const switcher = fixture();
  await switcher.auth.whenReady();
  await switcher.staff.loadSchools();
  switcher.emit('SIGNED_IN', session('account-b'));
  assert.equal(switcher.auth.boundary(), 'account-changed');
  assert.equal(switcher.staff.loaded(), false);
  assert.equal(switcher.staff.currentSchoolId(), null);
  assert.equal(switcher.panel.continueUrl(), '/school');

  const race = pending(), restoring = fixture(null, race.promise);
  restoring.emit('SIGNED_IN', session());
  restoring.emit('SIGNED_OUT', null);
  race.resolve(response(session()));
  await restoring.auth.whenReady();
  assert.equal(restoring.auth.session(), null, 'Late restoration cannot resurrect a signed-out session');
  assert.equal(restoring.auth.ready(), true);

  const failure = fixture(null, Promise.reject(new Error('Storage unavailable')));
  await failure.auth.whenReady();
  assert.equal(failure.auth.ready(), true, 'Failed restoration settles the guards');
  assert.equal(failure.auth.boundary(), 'restore-failed');
  assert.equal(failure.auth.isSignedIn(), false);

  const signingOut = fixture();
  await signingOut.auth.whenReady();
  await signingOut.staff.loadSchools();
  const signoutRequest = signingOut.auth.signOut();
  assert.equal(signingOut.auth.isSignedIn(), false, 'Hide account pages immediately, before the network response');
  assert.deepEqual(signingOut.staff.memberships(), []);
  await signoutRequest;
  assert.deepEqual(signingOut.state.logoutCalls, [{ scope: 'global' }]);
  assert.equal(signingOut.auth.boundary(), 'signed-out');
  assert.equal(signingOut.auth.signOutFailed(), false);
  assert.equal(signingOut.auth.session(), null);

  const remoteFailure = fixture();
  await remoteFailure.auth.whenReady();
  remoteFailure.state.logoutError = { message: 'Server unavailable' };
  await remoteFailure.auth.signOut();
  assert.equal(remoteFailure.auth.signOutFailed(), true, 'Remote failure cannot be presented as full revocation');
  assert.equal(remoteFailure.auth.session(), null, 'The SDK may still remove the local session on error');
  assert.equal(remoteFailure.auth.isSignedIn(), false);

  const thrown = fixture();
  await thrown.auth.whenReady();
  thrown.state.logoutThrows = true;
  await thrown.auth.signOut();
  assert.equal(thrown.auth.signOutFailed(), true);
  assert.ok(thrown.auth.session(), 'Do not pretend persisted credentials were removed when the SDK threw');
  assert.equal(thrown.auth.isSignedIn(), false);
  thrown.state.logoutThrows = false;
  await thrown.auth.signOut();
  assert.equal(thrown.auth.signOutFailed(), false, 'A blocked session can retry sign-out');
  assert.equal(thrown.auth.session(), null);

  const reset = fixture();
  await reset.auth.whenReady();
  reset.emit('PASSWORD_RECOVERY', session());
  reset.emit('USER_UPDATED', session());
  assert.equal(reset.auth.isPasswordRecovery(), false);
  await reset.auth.signOut('password-changed');
  assert.equal(reset.panel.title(), 'Password changed.');

  const expiry = fixture({ ...session(), expires_at: now / 1000 + 10 });
  await expiry.auth.whenReady();
  await expiry.staff.loadSchools();
  const expiryCallback = [...timers.values()].find(timer => timer.delay === 10_000).callback;
  now += 10_001;
  expiryCallback();
  assert.equal(expiry.auth.boundary(), 'session-expired');
  assert.equal(expiry.staff.currentSchoolId(), null);
  assert.equal(expiry.auth.isSignedIn(), false);
  expiry.emit('TOKEN_REFRESHED', session());
  assert.equal(expiry.auth.isSignedIn(), false, 'Renewal cannot revive old page caches');

  const resumed = fixture({ ...session(), expires_at: now / 1000 + 5 });
  await resumed.auth.whenReady();
  now += 5_001;
  window.dispatchEvent(new Event('focus'));
  assert.equal(resumed.auth.boundary(), 'session-expired', 'Check real expiry after background suspension');
  const missedLogout = fixture();
  await missedLogout.auth.whenReady();
  missedLogout.state.stored = null;
  window.dispatchEvent(new Event('pageshow'));
  await Promise.resolve();
  assert.equal(missedLogout.auth.boundary(), 'session-ended', 'Resume reconciles storage even if a tab missed the auth event');

  const late = fixture(), query = pending();
  await late.auth.whenReady();
  late.state.query = query.promise;
  const loading = late.staff.loadSchools();
  await Promise.resolve();
  late.emit('SIGNED_OUT', null);
  query.resolve({ data: rows, error: null });
  assert.deepEqual(await loading, []);
  assert.deepEqual(late.staff.memberships(), [], 'An old membership response cannot refill signed-out state');
  assert.equal(late.staff.currentSchoolId(), null);
  for (const guard of [staffGuard, adminGuard]) {
    const result = await runInInjectionContext(late.injector, () => guard({ queryParamMap: { get: () => null } }, { url: '/school' }));
    assert.deepEqual(result, ['/sign-in']);
  }

  const selected = fixture();
  await selected.auth.whenReady();
  await selected.staff.loadSchools();
  selected.staff.currentSchoolId.set('school-a');
  selected.state.rows = [{ role: 'staff', schools: { id: 'school-b' } }];
  await selected.staff.loadSchools();
  assert.equal(selected.staff.currentSchoolId(), 'school-b', 'Removed memberships cannot leave a stale selected school');
  assert.equal(selected.staff.isAdmin(), false);

  const concurrent = fixture(), firstRead = pending(), secondRead = pending();
  await concurrent.auth.whenReady();
  concurrent.state.query = firstRead.promise;
  const firstLoad = concurrent.staff.loadSchools();
  await Promise.resolve();
  concurrent.state.query = secondRead.promise;
  const secondLoad = concurrent.staff.loadSchools();
  await Promise.resolve();
  secondRead.resolve({ data: [{ role: 'staff', schools: { id: 'school-b' } }], error: null });
  await secondLoad;
  firstRead.resolve({ data: rows, error: null });
  await firstLoad;
  assert.equal(concurrent.staff.isAdmin(), false, 'An older response cannot restore a role removed by a newer read');
  assert.equal(concurrent.staff.memberships().length, 1);

  const guarded = fixture(), guardRead = pending();
  await guarded.auth.whenReady();
  guarded.state.query = guardRead.promise;
  const entering = runInInjectionContext(guarded.injector, () => staffGuard({ queryParamMap: { get: () => null } }, { url: '/school' }));
  await Promise.resolve();
  await Promise.resolve();
  guarded.emit('SIGNED_OUT', null);
  guardRead.resolve({ data: rows, error: null });
  assert.deepEqual(await entering, ['/sign-in'], 'Logout while the guard loads cannot activate the protected route');

  // Check that both root templates actually destroy the old outlets and navigation.
  const descendants = nodes => nodes.flatMap(node => [node, ...descendants(node.children ?? node.branches ?? [])]);
  for (const app of ['school-portal', 'parent-app']) {
    const source = await readFile(path.join(root, `projects/${app}/src/app/app.ts`), 'utf8');
    const template = source.match(/template: `([\s\S]*?)`,/)[1];
    const parsed = parseTemplate(template, app);
    assert.equal(parsed.errors, null);
    const boundary = descendants(parsed.nodes).find(node => node.branches?.[0].expression?.source === 'auth.boundary()');
    assert.ok(boundary);
    assert.ok(descendants(boundary.branches[0].children).some(node => node.name === 'skoolo-session-ended'));
    assert.equal(descendants(boundary.branches[0].children).some(node => ['router-outlet', 'ion-router-outlet', 'nav'].includes(node.name)), false);
    assert.ok(descendants(boundary.branches[1].children).some(node => ['router-outlet', 'ion-router-outlet'].includes(node.name)));
  }
  const panelSource = await readFile(path.join(root, 'projects/shared/src/lib/auth/session-ended.component.ts'), 'utf8');
  assert.doesNotMatch(panelSource, /routerLink/, 'Continue must create a fresh document, not reuse cached routes');
  assert.match(panelSource, /\[href\]="continueUrl\(\)"/);
  assert.equal(JSON.parse(await readFile(path.join(root, 'projects/parent-app/ngsw-config.json'), 'utf8')).dataGroups, undefined, 'Authenticated API responses are not service-worker data caches');
} finally {
  fixtures.forEach(item => item.injector.destroy());
  assert.ok(fixtures.every(item => item.state.unsubscribed));
  assert.equal(timers.size, 0, 'Session timers are cleaned up');
  Date.now = originalNow;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  delete globalThis.window;
  delete globalThis.document;
}
console.log('Session security checks passed: logout failures, stale restoration/reads, account changes, expiry/resume, recovery cleanup, guarded membership state and fresh-document continuation.');
