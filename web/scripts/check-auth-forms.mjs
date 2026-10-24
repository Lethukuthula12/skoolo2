// Controller and template-contract checks for the redesigned native forms. No browser or real login.
import '@angular/compiler';
import { parseTemplate } from '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular', 'auth-form-checks', 'controllers.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `
    export { AuthPage } from './projects/parent-app/src/app/features/auth/auth.page';
    export { SignInPage } from './projects/school-portal/src/app/features/auth/sign-in.page';
    export { AuthService, StaffService } from './projects/shared/src/public-api';
  `, resolveDir: root, sourcefile: 'auth-check.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: path.join(root, 'tsconfig.json'),
  // Ionic's Angular entry targets browsers. Only view metadata is stubbed here; production builds
  // compile the actual Ionic components/templates. Controllers and reactive forms are unmodified.
  plugins: [{ name: 'ionic-view-metadata', setup(plugin) {
    plugin.onResolve({ filter: /^@ionic\/angular\/standalone$/ }, () => ({ path: 'ionic-view', namespace: 'view-only' }));
    plugin.onLoad({ filter: /.*/, namespace: 'view-only' }, () => ({ contents:
      'export const IonBackButton={}, IonButton={}, IonButtons={}, IonContent={}, IonHeader={}, IonIcon={}, IonTitle={}, IonToolbar={};', loader: 'js' }));
  }}],
});
const { AuthPage, SignInPage, AuthService, StaffService } = await import(pathToFileURL(output).href);
function fixture(Page, params = {}) {
  const calls = [], navigation = [];
  const result = { signIn: null, signUp: { error: null, needsEmailConfirmation: true }, schools: [{ id: 'school' }] };
  const injector = Injector.create({ providers: [
    { provide: FormBuilder, useValue: new FormBuilder() },
    { provide: AuthService, useValue: {
      signIn: async (...args) => { calls.push(['signIn', ...args]); return result.signIn; },
      signUp: async value => { calls.push(['signUp', value]); return result.signUp; },
      signOut: async () => { calls.push(['signOut']); },
    }},
    { provide: StaffService, useValue: { reset: () => calls.push(['staff.reset']), loadSchools: async () => result.schools } },
    { provide: Router, useValue: { navigateByUrl: async url => { navigation.push(url); return true; } } },
    { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: key => params[key] ?? null } } } },
  ]});
  return { page: runInInjectionContext(injector, () => new Page()), calls, navigation, result, injector };
}
function descendants(nodes) {
  return nodes.flatMap(node => [node, ...descendants(node.children ?? node.branches ?? [])]);
}
async function checkFields(relative, page) {
  const parsed = parseTemplate(await readFile(path.join(root, relative), 'utf8'), relative);
  assert.equal(parsed.errors, null);
  const nodes = descendants(parsed.nodes);
  const attr = (node, name) => node.attributes?.find(a => a.name === name)?.value;
  for (const form of nodes.filter(node => node.name === 'form')) {
    const binding = form.inputs.find(input => input.name === 'formGroup').value.source;
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
for (const item of [parent, create, portal]) item.injector.destroy();
console.log('Auth checks passed: native form bindings, labels/autofill/help, password controls, validation, failed sign-in, return URLs, confirmation, account-mode links and no-school routing.');
