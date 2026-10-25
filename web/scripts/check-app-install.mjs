// Real install service/component with synthetic browser events; no native installation is claimed.
import '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { DestroyRef, Injector, runInInjectionContext, signal } from '@angular/core';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular/install-checks/components.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `
    export { AppInstallService } from './projects/parent-app/src/app/app-install.service';
    export { InstallHintComponent } from './projects/parent-app/src/app/features/directory/install-hint.component';
  `, resolveDir: root, sourcefile: 'install.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: path.join(root, 'tsconfig.json'),
});
const { AppInstallService, InstallHintComponent } = await import(pathToFileURL(output).href);
const original = Object.fromEntries(['navigator', 'window', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const fixtures = [];
function fixture({ ua = 'Mozilla/5.0 Android Chrome/130', standalone = false, iosStandalone = false, platform = '', touches = 0, storageBlocked = false } = {}) {
  const browser = new EventTarget(), mode = new EventTarget(), storage = new Map(), cleanup = [];
  mode.matches = standalone;
  browser.matchMedia = () => mode;
  const destroy = { destroyed: false, onDestroy: callback => { cleanup.push(callback); return () => {}; } };
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua, platform, maxTouchPoints: touches, standalone: iosStandalone }, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: {
    getItem: key => { if (storageBlocked) throw Error('blocked'); return storage.get(key); },
    setItem: (key, value) => { if (storageBlocked) throw Error('blocked'); storage.set(key, value); },
  }, configurable: true });
  const injector = Injector.create({ providers: [{ provide: DestroyRef, useValue: destroy }] });
  const service = runInInjectionContext(injector, () => new AppInstallService());
  const result = { browser, mode, service, destroy: () => { destroy.destroyed = true; cleanup.forEach(fn => fn()); injector.destroy(); } };
  fixtures.push(result);
  return result;
}
function offer(browser, { outcome = 'accepted', failure = false, choice } = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  let calls = 0;
  event.prompt = () => { calls++; return failure ? Promise.reject(Error('unavailable')) : Promise.resolve(); };
  event.userChoice = choice ?? Promise.resolve({ outcome });
  browser.dispatchEvent(event);
  return { event, calls: () => calls };
}
try {
  const android = fixture();
  assert.equal(android.service.canOffer(), true, 'Android gets manual help even without a browser event');
  assert.equal(android.service.canInstall(), false, 'Never offer a fake programmatic install');
  const first = offer(android.browser, { outcome: 'dismissed' });
  assert.equal(first.event.defaultPrevented, true);
  // Event arrives before a lazy route/component exists.
  const componentInjector = Injector.create({ providers: [{ provide: AppInstallService, useValue: android.service }] });
  const hint = runInInjectionContext(componentInjector, () => new InstallHintComponent());
  assert.equal(hint.visible(), true);
  assert.equal(android.service.canInstall(), true);
  const attempt = android.service.install();
  assert.equal(first.calls(), 1, 'The native prompt is invoked synchronously from the click');
  await android.service.install();
  await attempt;
  assert.equal(first.calls(), 1, 'Repeated clicks cannot reuse the event');
  assert.equal(android.service.busy(), false);
  assert.equal(android.service.canInstall(), false);
  assert.match(android.service.message(), /later/);
  await android.service.install();
  assert.equal(first.calls(), 1);
  assert.match(android.service.message(), /browser menu/);
  offer(android.browser, { failure: true });
  await android.service.install();
  assert.match(android.service.message(), /could not open/);
  assert.equal(android.service.busy(), false);
  offer(android.browser);
  await android.service.install();
  assert.equal(android.service.installed(), false, 'Accepting is not proof installation finished');
  android.service.dismiss();
  assert.equal(hint.visible(), false);
  // Construct Account's instance after directory dismissal; it still offers installation help.
  const account = runInInjectionContext(componentInjector, () => new InstallHintComponent());
  account.alwaysVisible = signal(true);
  assert.equal(account.visible(), true);
  android.browser.dispatchEvent(new Event('appinstalled'));
  assert.equal(android.service.canOffer(), false);
  assert.equal(account.visible(), false);
  assert.equal(android.service.message(), null);
  componentInjector.destroy();

  const inFlight = fixture();
  let finish;
  offer(inFlight.browser, { choice: new Promise(resolve => { finish = resolve; }) });
  const pending = inFlight.service.install();
  inFlight.browser.dispatchEvent(new Event('appinstalled'));
  finish({ outcome: 'accepted' });
  await pending;
  assert.equal(inFlight.service.message(), null, 'Late browser choice cannot restore a completed install banner');

  assert.equal(fixture({ standalone: true }).service.canOffer(), false);
  assert.equal(fixture({ ua: 'iPhone Safari', iosStandalone: true }).service.canOffer(), false);
  const ipad = fixture({ ua: 'Safari Macintosh', platform: 'MacIntel', touches: 5 });
  assert.equal(ipad.service.isIos, true);
  assert.equal(ipad.service.canOffer(), true);
  const iphone = fixture({ ua: 'iPhone CriOS/130 Safari' });
  assert.equal(iphone.service.isIos, true);
  assert.equal(iphone.service.canInstall(), false);
  const desktop = fixture({ ua: 'Windows Chrome/130' });
  assert.equal(desktop.service.canOffer(), false);
  offer(desktop.browser);
  assert.equal(desktop.service.canOffer(), true);
  desktop.mode.matches = true;
  desktop.mode.dispatchEvent(new Event('change'));
  assert.equal(desktop.service.canOffer(), false);
  const blocked = fixture({ storageBlocked: true });
  blocked.service.dismiss();
  assert.equal(blocked.service.dismissed(), true);
  assert.equal(fixture().service.dismissed(), false, 'Dismissal does not hide the offer forever');
  const destroyed = fixture();
  destroyed.destroy();
  const late = offer(destroyed.browser);
  assert.equal(late.event.defaultPrevented, false, 'Listeners are removed on destroy');
  assert.equal(destroyed.service.canInstall(), false);
  fixtures.splice(fixtures.indexOf(destroyed), 1);

  const appConfig = await readFile(path.join(root, 'projects/parent-app/src/app/app.config.ts'), 'utf8');
  assert.match(appConfig, /provideAppInitializer\(\(\) => \{ inject\(AppInstallService\); \}\)/);
  const manifest = JSON.parse(await readFile(path.join(root, 'projects/parent-app/public/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.start_url && manifest.scope);
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
    assert.ok(icon, `Required ${size}px icon`);
    const png = await readFile(path.join(root, 'projects/parent-app/public', icon.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  console.log('PASS: install offer capture, single-use prompt, cancellation/failure, lifecycle, platform help and manifest icons');
} finally {
  for (const fixture of fixtures) fixture.destroy();
  for (const [key, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
