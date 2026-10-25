// Real loader/component with synthetic DOM/API callbacks. No browser, network or live challenge.
import '@angular/compiler';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { Injector, runInInjectionContext } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.angular/challenge-checks/components.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: { contents: `
    export { TurnstileService } from './projects/shared/src/lib/auth/turnstile.service';
    export { AuthChallengeComponent } from './projects/shared/src/lib/auth/auth-challenge.component';
  `, resolveDir: root, sourcefile: 'challenges.ts' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: path.join(root, 'tsconfig.json'),
});
const { TurnstileService, AuthChallengeComponent } = await import(pathToFileURL(output).href);
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout, originalNow = Date.now;
const timers = new Map();
let timerId = 0, now = 1000000;
globalThis.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
Date.now = () => now;
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
try {
  const scripts = [];
  const document = {
    defaultView: {}, head: { appendChild: script => scripts.push(script) },
    createElement: tag => { assert.equal(tag, 'script'); return { removed: false, remove() { this.removed = true; } }; },
  };
  const loaderInjector = Injector.create({ providers: [{ provide: DOCUMENT, useValue: document }] });
  const loader = runInInjectionContext(loaderInjector, () => new TurnstileService());
  const failedLoad = loader.load();
  assert.equal(loader.load(), failedLoad, 'Concurrent widgets share one script load');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  const rejected = assert.rejects(failedLoad, /unavailable/);
  scripts[0].onerror();
  await rejected;
  assert.equal(scripts[0].removed, true);
  const slowLoad = loader.load();
  const timedOut = assert.rejects(slowLoad, /unavailable/);
  const timeout = [...timers.values()].find(timer => timer.delay === 15000);
  timeout.callback();
  await timedOut;
  assert.equal(scripts[1].removed, true, 'A stalled script can be retried');
  const loaded = loader.load();
  const api = { render() {}, remove() {} };
  document.defaultView.turnstile = api;
  scripts[2].onload();
  assert.equal(await loaded, api);
  assert.equal(await loader.load(), api);
  assert.equal(scripts.length, 3, 'A loaded script is reused');
  loaderInjector.destroy();

  const renders = [], removed = [];
  const widgetApi = {
    render: (container, options) => { renders.push(options); return 'widget-' + renders.length; },
    remove: id => removed.push(id),
  };
  let loadFailure = false;
  const injector = Injector.create({ providers: [{ provide: TurnstileService, useValue: {
    load: async () => { if (loadFailure) throw new Error('Offline'); return widgetApi; },
  } }] });
  const component = runInInjectionContext(injector, () => new AuthChallengeComponent());
  component.widget = { nativeElement: {} };
  component.ngAfterViewInit();
  await settle();
  assert.equal(component.verified(), false);
  assert.equal(renders[0].sitekey, '0x4AAAAAAFkocbVeilMu8IeC');
  assert.equal(renders[0]['response-field'], false, 'No hidden token input is added to the DOM');
  assert.equal(renders[0].size, 'compact', 'Fits narrow phone forms');
  renders[0].callback('synthetic-once');
  assert.equal(component.verified(), true);
  assert.equal(component.takeToken(), 'synthetic-once');
  renders[0].callback('synthetic-once');
  assert.equal(component.takeToken(), null, 'A duplicate provider callback cannot reuse a consumed token');
  component.reset();
  await settle();
  assert.deepEqual(removed, ['widget-1']);
  renders[0].callback('stale-token');
  assert.equal(component.verified(), false, 'Removed widgets cannot populate the current token');
  renders.at(-1).callback('synthetic-expired');
  now += 270001;
  assert.equal(component.takeToken(), null, 'Clock check catches expiry after tab suspension');
  for (const callback of ['expired-callback', 'timeout-callback', 'error-callback', 'unsupported-callback']) {
    component.reset();
    await settle();
    renders.at(-1).callback('synthetic-ready');
    renders.at(-1)[callback]();
    assert.equal(component.verified(), false);
    assert.ok(component.error());
  }
  component.reset();
  await settle();
  [...timers.values()].find(timer => timer.delay === 45000).callback();
  assert.match(component.error(), /too long/);
  loadFailure = true;
  component.reset();
  await settle();
  assert.equal(component.verified(), false);
  assert.match(component.error(), /could not load/);
  loadFailure = false;
  component.reset();
  await settle();
  renders.at(-1).callback('before-destroy');
  injector.destroy();
  assert.equal(component.verified(), false);
  renders.at(-1).callback('after-destroy');
  assert.equal(component.verified(), false);
  const renderedCount = renders.length;
  component.reset();
  await settle();
  assert.equal(renders.length, renderedCount);
  assert.equal(timers.size, 0, 'Cleanup leaves no challenge timers');
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  Date.now = originalNow;
}
console.log('Challenge checks passed: script sharing, load failure/timeout/retry, single-use tokens, expiry, stale callbacks, widget errors and cleanup.');
