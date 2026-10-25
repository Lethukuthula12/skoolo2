// Controller and template-contract checks for the redesigned native forms. No browser or real login.
import '@angular/compiler';
import { parseTemplate } from '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular', 'auth-form-checks', 'controllers.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `
    export { AuthPage } from './projects/parent-app/src/app/features/auth/auth.page';
    export { SignInPage } from './projects/school-portal/src/app/features/auth/sign-in.page';
    export { JoinPage } from './projects/school-portal/src/app/features/auth/join.page';
    export { RegisterSchoolPage } from './projects/school-portal/src/app/features/auth/register-school.page';
    export { ResetPasswordPage as ParentReset } from './projects/parent-app/src/app/features/auth/reset-password.page';
    export { ResetPasswordPage as PortalReset } from './projects/school-portal/src/app/features/auth/reset-password.page';
    export { AuthService, StaffService, SchoolDirectoryService, SUPABASE_CLIENT } from './projects/shared/src/public-api';
    export { staffGuard } from './projects/shared/src/lib/staff/staff.guard';
  `, resolveDir: root, sourcefile: 'auth-check.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: path.join(root, 'tsconfig.json'),
  // Ionic's Angular entry targets browsers. Only view metadata is stubbed here; production builds
  // compile the actual Ionic components/templates. Controllers and reactive forms are unmodified.
  plugins: [{ name: 'ionic-view-metadata', setup(plugin) {
    plugin.onResolve({ filter: /^@ionic\/angular\/standalone$/ }, () => ({ path: 'ionic-view', namespace: 'view-only' }));
    plugin.onLoad({ filter: /.*/, namespace: 'view-only' }, () => ({ contents:
      'export const IonBackButton={}, IonButton={}, IonButtons={}, IonContent={}, IonHeader={}, IonIcon={}, IonInput={}, IonSpinner={}, IonTitle={}, IonToolbar={};', loader: 'js' }));
  }}],
});
const { AuthPage, SignInPage, JoinPage, RegisterSchoolPage, ParentReset, PortalReset, AuthService, StaffService, SchoolDirectoryService, SUPABASE_CLIENT, staffGuard } = await import(pathToFileURL(output).href);
let reloads = 0;
globalThis.window = { location: { origin: 'https://app.skoolo.co.za', reload: () => { ++reloads; } }, addEventListener() {}, removeEventListener() {} };
globalThis.document = { addEventListener() {}, removeEventListener() {} };
const fixtures = [];
function fixture(Page, params = {}) {
  const calls = [], navigation = [];
  const result = { signIn: null, signUp: { error: null, needsEmailConfirmation: true }, updatePassword: null, schools: [{ id: 'school' }], navigation: true, navigationError: null, schoolError: null };
  const signedIn = signal(false), recovery = signal(false);
  const injector = Injector.create({ providers: [
    { provide: FormBuilder, useValue: new FormBuilder() },
    { provide: AuthService, useValue: {
      signIn: async (...args) => { calls.push(['signIn', ...args]); return result.signIn; },
      signUp: async value => { calls.push(['signUp', value]); if (!result.signUp.error && !result.signUp.needsEmailConfirmation) signedIn.set(true); return result.signUp; },
      signOut: async () => { calls.push(['signOut']); signedIn.set(false); recovery.set(false); },
      signOutFailed: () => false,
      isSignedIn: signedIn, isPasswordRecovery: recovery, whenReady: async () => {},
      updatePassword: async value => { calls.push(['updatePassword', value]); return result.updatePassword; },
    }},
    { provide: StaffService, useValue: {
      reset: () => calls.push(['staff.reset']), loadSchools: async () => result.schools,
      acceptInvite: async code => calls.push(['acceptInvite', code]),
      claimSchool: async id => { calls.push(['claimSchool', id]); if (result.schoolError) throw result.schoolError; return { id, name: 'Claimed School' }; },
      createSchool: async school => { calls.push(['createSchool', school]); if (result.schoolError) throw result.schoolError; return { ...school, id: 'new-school' }; },
    } },
    { provide: SchoolDirectoryService, useValue: { grades: async () => [] } },
    { provide: Router, useValue: { navigateByUrl: async url => { navigation.push(url); if (result.navigationError) throw result.navigationError; return result.navigation; } } },
    { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: key => params[key] ?? null } } } },
  ]});
  const item = { page: runInInjectionContext(injector, () => new Page()), calls, navigation, result, injector, signedIn, recovery };
  fixtures.push(item);
  return item;
}
function descendants(nodes) {
  return nodes.flatMap(node => [node, ...descendants(node.children ?? node.branches ?? [])]);
}
async function checkFields(relative, page, selectedForm) {
  const source = await readFile(path.join(root, relative), 'utf8');
  const template = relative.endsWith('.ts') ? source.match(/template: `([\s\S]*?)`,/)[1] : source;
  const parsed = parseTemplate(template, relative);
  assert.equal(parsed.errors, null);
  const nodes = descendants(parsed.nodes);
  const attr = (node, name) => node.attributes?.find(a => a.name === name)?.value;
  for (const form of nodes.filter(node => node.name === 'form')) {
    const binding = form.inputs.find(input => input.name === 'formGroup').value.source;
    if (selectedForm && binding !== selectedForm) continue;
    const controls = descendants(form.children).filter(node => node.name === 'input');
    assert.deepEqual(controls.map(node => attr(node, 'formControlName')).sort(), Object.keys(page[binding].controls).sort(), 'Every form field remains connected to its reactive control');
    for (const input of controls) {
      const id = attr(input, 'id');
      assert.ok(id && nodes.some(node => node.name === 'label' && attr(node, 'for') === id), 'Every native field has an explicit label');
      assert.ok(attr(input, 'autocomplete'), 'Native controls keep autofill hints');
      for (const hint of (attr(input, 'aria-describedby') ?? '').split(' ').filter(Boolean)) {
        assert.ok(nodes.some(node => attr(node, 'id') === hint), 'Field help is associated with a real hint');
      }
    }
  }
  for (const toggle of nodes.filter(node => node.name === 'button' && attr(node, 'aria-controls'))) {
    assert.equal(attr(toggle, 'type'), 'button', 'Password visibility must not submit the form');
    assert.ok(nodes.some(node => node.name === 'input' && attr(node, 'id') === attr(toggle, 'aria-controls')));
  }
  return nodes;
}

const parent = fixture(AuthPage, { returnUrl: '/apply/example-school' });
await checkFields('projects/parent-app/src/app/features/auth/auth.page.html', parent.page);
assert.equal(parent.page.signInForm.valid, false);
parent.page.signInForm.setValue({ email: 'parent@example.com', password: 'example-password' });
assert.equal(parent.page.signInForm.valid, true);
parent.result.signIn = { message: 'Invalid login credentials' };
await parent.page.signIn();
assert.equal(parent.page.error(), 'That email and password do not match.');
assert.equal(parent.page.busy(), false);
assert.equal(parent.navigation.length, 0);
parent.result.signIn = null;
await parent.page.signIn();
assert.deepEqual(parent.navigation, ['/apply/example-school']);
parent.page.passwordVisible.set(true);
parent.page.switchMode('sign_up');
assert.equal(parent.page.passwordVisible(), false, 'Changing form hides the password');
assert.equal(parent.page.error(), null);
parent.page.signUpForm.setValue({ fullName: 'Example Parent', phone: '0821234567', email: 'parent@example.com', password: 'short' });
assert.equal(parent.page.signUpForm.valid, false, 'Existing minimum password length is preserved');
parent.page.signUpForm.patchValue({ password: 'example-password' });
assert.equal(parent.page.signUpForm.valid, true);
await parent.page.signUp();
assert.equal(parent.page.mode(), 'sign_in');
assert.match(parent.page.notice(), /confirmation link/);
assert.equal(parent.navigation.length, 1, 'Email confirmation does not navigate before sign-in');
assert.equal(parent.page.signInForm.value.email, 'parent@example.com');
assert.equal(parent.calls.find(call => call[0] === 'signUp')[1].emailRedirectTo, 'https://app.skoolo.co.za/auth');
await parent.page.signOut();
assert.equal(parent.navigation.at(-1), '/');
const create = fixture(AuthPage, { mode: 'sign_up' });
assert.equal(create.page.mode(), 'sign_up', 'School application links can still open account creation');

const portal = fixture(SignInPage, { returnUrl: '/reports' });
await checkFields('projects/school-portal/src/app/features/auth/sign-in.page.html', portal.page);
portal.page.form.setValue({ email: 'teacher@example.com', password: 'example-password' });
portal.result.signIn = { message: 'Invalid login credentials' };
await portal.page.signIn();
assert.equal(portal.page.error(), 'That email and password do not match.');
assert.equal(portal.page.busy(), false);
assert.equal(portal.navigation.length, 0);
assert.equal(portal.calls.some(call => call[0] === 'staff.reset'), false, 'Failed sign-in does not load school state');
portal.result.signIn = null;
await portal.page.signIn();
assert.equal(portal.navigation.at(-1), '/reports');
portal.result.schools = [];
await portal.page.signIn();
assert.equal(portal.navigation.at(-1), '/no-school');

// Existing accounts with no membership can still finish joining or registering a school.
for (const returnUrl of ['/join', '/join?code=TESTCODE', '/register-school']) {
  const onboarding = fixture(SignInPage, { returnUrl });
  onboarding.result.schools = [];
  onboarding.page.form.setValue({ email: 'staff@example.com', password: 'example-password' });
  await onboarding.page.signIn();
  assert.equal(onboarding.navigation.at(-1), returnUrl);
}

globalThis.window.location.origin = 'https://schools.skoolo.co.za';
const account = { fullName: 'Example Admin', phone: '0821234567', email: 'admin@example.com', password: 'example-password' };
const join = fixture(JoinPage, { code: 'TESTCODE' });
join.page.signUpForm.patchValue(account);
await join.page.signUpAndRedeem();
assert.equal(join.calls[0][1].emailRedirectTo, 'https://schools.skoolo.co.za/join');
assert.match(join.page.notice(), /confirmation link/);
assert.equal(join.page.busy(), false);
assert.equal(join.calls.some(call => call[0] === 'acceptInvite'), false, 'Unconfirmed accounts never redeem invitations');
assert.deepEqual(join.navigation, [], 'Wait for email confirmation before navigating');
assert.equal(join.page.signUpForm.value.password, '', 'Clear the password while waiting for confirmation');
join.signedIn.set(true);
await join.page.redeem();
assert.deepEqual(join.calls.at(-1), ['acceptInvite', 'TESTCODE']);
assert.equal(join.navigation.at(-1), '/applications');
await join.page.switchAccount({ preventDefault() {} });
assert.equal(reloads, 1, 'Switching invite accounts reloads the invitation URL without cached pages');
const immediateJoin = fixture(JoinPage);
immediateJoin.result.signUp.needsEmailConfirmation = false;
immediateJoin.page.signUpForm.setValue({ ...account, code: 'NEWCODE1' });
await immediateJoin.page.signUpAndRedeem();
assert.deepEqual(immediateJoin.calls.at(-1), ['acceptInvite', 'NEWCODE1'], 'Current confirmation-disabled setup still works');

const registration = fixture(RegisterSchoolPage);
const registrationNodes = await checkFields('projects/school-portal/src/app/features/auth/register-school.page.ts', registration.page, 'accountForm');
assert.equal(registration.page.passwordVisible(), false, 'Registration passwords are hidden initially');
assert.equal(registration.page.confirmationEmail(), null, 'New registrations start at the login form');
registration.page.accountForm.setValue(account);
registration.page.passwordVisible.set(true);
assert.equal(registration.page.accountForm.value.password, account.password, 'Revealing the password retains its value');
registration.page.schoolForm.patchValue({ name: 'Example School', town: 'Example Town', province: 'Gauteng' });
await registration.page.register();
await registration.page.claim({ id: 'unclaimed-school' });
assert.equal(registration.calls.length, 0, 'School writes require a signed-in account');
await registration.page.createAccount();
assert.equal(registration.calls[0][1].emailRedirectTo, 'https://schools.skoolo.co.za/register-school');
assert.equal(registration.page.confirmationEmail(), account.email, 'A successful request moves to the email-confirmation step');
assert.equal(registration.page.accountForm.value.password, '', 'The confirmation step does not retain the password');
assert.equal(registration.page.passwordVisible(), false, 'The password is masked again after submitting');
assert.equal(registration.calls.length, 1, 'Creating an unconfirmed login does not create or claim a school');
assert.deepEqual(registration.navigation, []);
const confirmationBranch = registrationNodes.find(node => node.branches?.some(branch => branch.expression?.source === 'confirmationEmail()')).branches[0];
const confirmationNodes = descendants(confirmationBranch.children);
assert.ok(confirmationNodes.some(node => node.name === 'section' && node.attributes.some(attr => attr.name === 'aria-labelledby' && attr.value === 'confirmation-title')));
assert.equal(confirmationNodes.some(node => node.name === 'input' || node.name === 'form'), false, 'The confirmation step replaces the login fields instead of leaving a disabled submit button');
assert.ok(confirmationNodes.some(node => node.name === 'a' && node.inputs.some(input => input.name === 'queryParams' && input.value.source.includes('/register-school'))), 'Signing in from the confirmation step returns to school registration');
registration.page.accountForm.patchValue({ password: account.password });
await registration.page.createAccount();
await registration.page.register();
await registration.page.claim({ id: 'unclaimed-school' });
assert.equal(registration.calls.length, 1, 'Waiting for confirmation neither resubmits signup nor writes a school');
registration.page.editAccount();
assert.equal(registration.page.confirmationEmail(), null, 'Changing the email returns to the login form');
assert.equal(registration.page.accountForm.value.email, account.email, 'Keep the entered details available for correction');
assert.equal(registration.page.accountForm.value.password, '', 'Returning to the form clears the password');
assert.equal(registration.page.passwordVisible(), false);
registration.page.accountForm.patchValue({ email: 'another-admin@example.com', password: account.password });
await registration.page.createAccount();
assert.equal(registration.page.confirmationEmail(), 'another-admin@example.com', 'The next confirmation step displays the corrected email');
registration.signedIn.set(true);
await registration.page.register();
assert.equal(registration.calls.at(-1)[0], 'createSchool');
assert.equal(registration.navigation.at(-1), '/school?school=new-school');
const claimRegistration = fixture(RegisterSchoolPage);
claimRegistration.signedIn.set(true);
await claimRegistration.page.claim({ id: 'unclaimed-school' });
assert.deepEqual(claimRegistration.calls.at(-1), ['claimSchool', 'unclaimed-school']);
assert.equal(claimRegistration.navigation.at(-1), '/school?school=unclaimed-school');
const immediateRegistration = fixture(RegisterSchoolPage);
immediateRegistration.page.accountForm.setValue(account);
immediateRegistration.result.signUp.needsEmailConfirmation = false;
await immediateRegistration.page.createAccount();
assert.equal(immediateRegistration.signedIn(), true);
assert.equal(immediateRegistration.page.confirmationEmail(), null, 'An immediate session does not display an unnecessary email step');
assert.equal(immediateRegistration.calls.length, 1, 'Account creation precedes school details even when confirmation is disabled');
const failedRegistration = fixture(RegisterSchoolPage);
failedRegistration.page.accountForm.setValue(account);
failedRegistration.result.signUp.error = new Error('Email delivery unavailable');
await failedRegistration.page.createAccount();
assert.equal(failedRegistration.page.error(), 'Email delivery unavailable');
assert.equal(failedRegistration.page.busy(), false);
assert.equal(failedRegistration.signedIn(), false);
assert.equal(failedRegistration.page.confirmationEmail(), null, 'A failed signup stays on the form');
assert.equal(failedRegistration.page.accountForm.value.password, account.password, 'A failed signup retains input for correction');

// Once the write succeeds, neither an old deployment chunk nor a cancelled navigation can
// expose the registration form again or replay either onboarding mutation.
for (const method of ['register', 'claim']) {
  for (const failure of ['chunk', 'membership', 'cancelled']) {
    const saved = fixture(RegisterSchoolPage);
    saved.signedIn.set(true);
    saved.page.schoolForm.patchValue({ name: 'Example School', town: 'Example Town', province: 'Gauteng' });
    if (failure === 'cancelled') saved.result.navigation = false;
    else saved.result.navigationError = new Error(failure === 'chunk'
      ? 'Failed to fetch dynamically imported module: https://schools.example/chunk-OLD.js'
      : 'Membership refresh unavailable');
    await saved.page[method]({ id: 'claimed-school' });
    const id = method === 'register' ? 'new-school' : 'claimed-school';
    assert.equal(saved.page.savedSchool().id, id);
    assert.equal(saved.page.workspaceUnavailable(), true);
    assert.equal(saved.page.error(), null, 'A navigation failure must not be described as a failed registration');
    assert.equal(saved.page.busy(), false);
    assert.equal(saved.page.schoolUrl(), '/school?school=' + id, 'A full reload retains the destination school');
    await saved.page.register();
    await saved.page.claim({ id: 'another-school' });
    assert.equal(saved.calls.length, 1, 'Never repeat the saved mutation or start another claim on this page');
  }
}
const rejectedSchool = fixture(RegisterSchoolPage);
rejectedSchool.signedIn.set(true);
rejectedSchool.page.schoolForm.patchValue({ name: 'Example School', town: 'Example Town', province: 'Gauteng' });
rejectedSchool.result.schoolError = new Error('School could not be created');
await rejectedSchool.page.register();
assert.equal(rejectedSchool.page.savedSchool(), null);
assert.equal(rejectedSchool.page.error(), 'School could not be created');
assert.equal(rejectedSchool.page.busy(), false);
assert.equal(rejectedSchool.navigation.length, 0);
rejectedSchool.result.schoolError = null;
await rejectedSchool.page.register();
assert.equal(rejectedSchool.calls.length, 2, 'A genuine rejected write remains retryable');
assert.equal(rejectedSchool.page.workspaceUnavailable(), false);
const savedBranch = registrationNodes.find(node => node.branches?.some(branch => branch.expression?.source === 'savedSchool()')).branches[0];
const savedNodes = descendants(savedBranch.children);
assert.equal(savedNodes.some(node => node.name === 'form'), false, 'Saved schools replace the creation form');
assert.ok(savedNodes.some(node => node.name === 'a' && node.inputs.some(input => input.name === 'href' && input.value.source === 'schoolUrl()') && !node.inputs.some(input => input.name === 'routerLink')), 'Recovery uses a document load to fetch current assets');

// Use the real service and guard: the RPC result is returned before any follow-up reads.
// On continuation, refreshed memberships are scoped to the current user, and URL hints cannot
// select another tenant. No production data or actual requests are involved.
const staffCalls = [];
const staffResult = { rpcError: null, readError: null, signedIn: true, rows: [
  { role: 'staff', schools: { id: 'first-school' } },
  { role: 'admin', schools: { id: 'new-school' } },
] };
let realStaff;
const staffInjector = Injector.create({ providers: [
  { provide: SUPABASE_CLIENT, useValue: {
    rpc: async (name, input) => { staffCalls.push(['rpc', name, input]); return { data: { id: 'new-school', name: 'Example School' }, error: staffResult.rpcError }; },
    auth: { getSession: async () => ({ data: { session: staffResult.signedIn ? { user: { id: 'current-user' } } : null } }) },
    from: table => ({ select: columns => ({ eq: async (column, value) => {
      staffCalls.push(['read', table, columns, column, value]);
      return { data: staffResult.rows, error: staffResult.readError };
    } }) }),
  } },
  { provide: StaffService, useFactory: () => realStaff },
  { provide: AuthService, useValue: {
    whenReady: async () => {}, isSignedIn: () => staffResult.signedIn,
    user: () => staffResult.signedIn ? { id: 'current-user' } : null,
    stateInvalidated: new Subject(),
  } },
  { provide: Router, useValue: { createUrlTree: (commands, extras) => ({ commands, extras }) } },
] });
realStaff = runInInjectionContext(staffInjector, () => new StaffService());
const guard = school => runInInjectionContext(staffInjector, () => staffGuard(
  { queryParamMap: { get: key => key === 'school' ? school : null } }, { url: '/school?school=' + school },
));
for (const method of ['createSchool', 'claimSchool']) {
  staffCalls.length = 0;
  staffResult.readError = new Error('Read unavailable');
  const saved = await realStaff[method](method === 'createSchool' ? { name: 'Example School', town: 'Example Town', province: 'Gauteng' } : 'new-school');
  assert.equal(saved.id, 'new-school', 'A committed write is returned even when the subsequent membership read will fail');
  assert.equal(staffCalls.length, 1);
  assert.equal(realStaff.loaded(), false, 'The destination must refresh memberships');
  await assert.rejects(guard('new-school'), /Read unavailable/);
  assert.equal(realStaff.loaded(), false);
  staffResult.readError = null;
  assert.equal(await guard('new-school'), true);
  assert.equal(realStaff.currentSchoolId(), 'new-school', 'Recovery restores the created school even if it is not the first membership');
  assert.equal(realStaff.isAdmin(), true);
  assert.deepEqual(staffCalls.at(-1), ['read', 'school_staff', 'school_id, role, schools(*)', 'user_id', 'current-user']);
  assert.equal(staffCalls.filter(call => call[0] === 'rpc').length, 1, 'Membership recovery never replays the RPC');
  realStaff.reset();
  assert.equal(await guard('other-tenant'), true);
  assert.equal(realStaff.currentSchoolId(), 'first-school', 'An unowned URL hint cannot select another tenant');
  assert.equal(realStaff.isAdmin(), false, 'School selection keeps the role from the actual membership');
  staffResult.rpcError = new Error('Write denied');
  await assert.rejects(realStaff[method](method === 'createSchool' ? { name: 'Example School' } : 'new-school'), /Write denied/);
  assert.equal(realStaff.currentSchoolId(), 'first-school', 'A rejected write does not discard valid membership state');
  staffResult.rpcError = null;
}
staffResult.signedIn = false;
realStaff.reset();
assert.deepEqual((await guard('new-school')).commands, ['/sign-in']);
staffResult.signedIn = true;
staffResult.rows = [];
assert.deepEqual((await guard('new-school')).commands, ['/no-school']);
staffInjector.destroy();

for (const [Page, app] of [[ParentReset, 'parent-app'], [PortalReset, 'school-portal']]) {
  const reset = fixture(Page);
  reset.page.ready.set(true);
  reset.page.form.setValue({ password: 'example-password', confirm: 'example-password' });
  await reset.page.submit();
  assert.equal(reset.calls.length, 0, 'Expired links cannot change passwords');
  reset.recovery.set(true);
  reset.page.form.patchValue({ confirm: 'different-password' });
  await reset.page.submit();
  assert.match(reset.page.error(), /do not match/);
  assert.equal(reset.calls.length, 0);
  reset.page.form.patchValue({ confirm: 'example-password' });
  reset.result.updatePassword = { message: 'Password update failed' };
  await reset.page.submit();
  assert.equal(reset.page.error(), 'Password update failed');
  assert.equal(reset.page.done(), false);
  reset.result.updatePassword = null;
  await reset.page.submit();
  assert.equal(reset.page.done(), true);
  assert.equal(reset.page.canReset(), false, 'Recovery ends after a successful reset');
  assert.equal(reset.calls.at(-1)[0], 'signOut');
  const count = reset.calls.length;
  await reset.page.submit();
  assert.equal(reset.calls.length, count, 'A completed reset cannot submit again');
  const source = await readFile(path.join(root, `projects/${app}/src/app/features/auth/reset-password.page.ts`), 'utf8');
  const parsed = parseTemplate(source.match(/template: `([\s\S]*?)`,/)[1], app);
  assert.equal(parsed.errors, null);
  const branches = descendants(parsed.nodes).find(node => node.branches?.some(branch => branch.expression?.source === 'done()')).branches;
  const state = { '!ready()': !reset.page.ready(), 'done()': reset.page.done(), '!canReset()': !reset.page.canReset() };
  const visible = branches.find(branch => !branch.expression || state[branch.expression.source]);
  assert.equal(visible.expression.source, 'done()', 'Signed-out success shows Password changed, not Link expired');
  if (app === 'parent-app') assert.match(source, /imports:\s*\[\s*ReactiveFormsModule, RouterLink/, 'Reset navigation has its router directive');
}

// Exercise the real shared service to prove the app-specific URL reaches the Supabase client.
const forgotSource = await readFile(path.join(root, 'projects/parent-app/src/app/features/auth/forgot-password.page.ts'), 'utf8');
assert.match(forgotSource, /imports:\s*\[\s*ReactiveFormsModule, RouterLink/, 'Forgot-password Back button has its router directive');
let signupRequest;
const serviceInjector = Injector.create({ providers: [{ provide: SUPABASE_CLIENT, useValue: { auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  signUp: async request => { signupRequest = request; return { data: { session: null }, error: null }; },
} } }] });
const service = runInInjectionContext(serviceInjector, () => new AuthService());
await service.whenReady();
const confirmation = await service.signUp({ ...account, emailRedirectTo: 'https://schools.skoolo.co.za/join' });
assert.equal(signupRequest.options.emailRedirectTo, 'https://schools.skoolo.co.za/join');
assert.equal(confirmation.needsEmailConfirmation, true);
serviceInjector.destroy();
for (const item of fixtures) item.injector.destroy();
delete globalThis.window;
delete globalThis.document;
console.log('Auth checks passed: form contracts, login failures, app-specific confirmation URLs, verified onboarding, saved-school navigation recovery, membership-scoped school selection, immediate-session compatibility, no-school routing and password-reset success/expiry/failure.');
