import '@angular/compiler';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';

// Inspect the actual Ionic animation builder without launching a browser or loading school data.
const source = await readFile(new URL('../projects/parent-app/src/app/page-transition.ts', import.meta.url), 'utf8');
const directory = new URL('../.angular/motion-checks/', import.meta.url);
await mkdir(directory, { recursive: true });
const compiled = new URL('page-transition.mjs', directory);
await writeFile(compiled, ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
}}).outputText.replace("'@ionic/angular/standalone'", "'@ionic/core/components/index.js'"));
// Ionic Angular re-exports this same createAnimation function. Node needs the explicit index file.
const { parentPageTransition } = await import(compiled.href);
const element = reduced => ({ nodeType: 1, ownerDocument: { defaultView: {
  matchMedia: query => ({ matches: query === '(prefers-reduced-motion: reduce)' && reduced }),
}}});
for (const direction of ['forward', 'back']) {
  const enteringEl = element(false), leavingEl = element(false);
  const animation = parentPageTransition(null, { enteringEl, leavingEl, direction });
  assert.equal(animation.getDuration(), 220);
  assert.equal(animation.childAnimations.length, 2, 'Both incoming and cached outgoing pages participate');
  const entering = animation.childAnimations[0];
  assert.equal(entering.elements[0], enteringEl);
  const frames = entering.getKeyframes();
  assert.match(frames[0].transform, direction === 'back' ? /-10px/ : /\(10px/);
  assert.equal(frames.at(-1).opacity, 1);
  assert.equal(frames.at(-1).transform, 'none');
}
const firstVisit = parentPageTransition(null, { enteringEl: element(false), direction: 'forward' });
assert.equal(firstVisit.childAnimations.length, 1, 'First visit works without an outgoing page');
const reduced = parentPageTransition(null, { enteringEl: element(true), leavingEl: element(true), direction: 'back' });
// Ionic clamps 0ms to 1ms in its CSS-animation fallback so Safari still completes navigation.
assert.ok(reduced.getDuration() <= 1, 'Reduced motion uses only the framework completion tick');
for (const animation of reduced.childAnimations) {
  for (const frame of animation.getKeyframes()) {
    assert.equal(frame.opacity, 1, 'Reduced motion never fades a page out');
    if (frame.transform) assert.equal(frame.transform, 'none', 'Reduced motion never moves a page');
  }
}
console.log('Parent motion checks passed: forward/back, cached outgoing page, first visit and reduced motion.');
