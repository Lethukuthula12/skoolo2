import { AnimationBuilder, createAnimation } from '@ionic/angular/standalone';

/** A short fade and slide that also works when Ionic restores a cached page. */
export const parentPageTransition: AnimationBuilder = (_base, options) => {
  const entering = options.enteringEl as HTMLElement;
  const leaving = options.leavingEl as HTMLElement | undefined;
  const reduced = entering.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  const backward = options.direction === 'back';
  const transition = createAnimation('parent-page').duration(reduced ? 0 : 220)
    .easing('cubic-bezier(.22, 1, .36, 1)');
  transition.addAnimation(createAnimation('parent-page-enter').addElement(entering)
    .beforeRemoveClass('ion-page-invisible')
    .fromTo('opacity', reduced ? 1 : 0, 1)
    .fromTo('transform', reduced ? 'none' : `translate3d(${backward ? -10 : 10}px, 0, 0)`, 'none')
    .afterClearStyles(['opacity', 'transform']));
  if (leaving) transition.addAnimation(createAnimation('parent-page-leave').addElement(leaving)
    .fromTo('opacity', 1, reduced ? 1 : 0)
    .afterClearStyles(['opacity', 'transform']));
  return transition;
};
