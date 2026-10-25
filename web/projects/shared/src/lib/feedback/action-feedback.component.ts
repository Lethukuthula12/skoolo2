import { Component, DestroyRef, effect, inject, input, untracked } from '@angular/core';
import { ActionFeedbackService } from './action-feedback.service';

/** Connect existing page state to the root overlay, outside scrolling/animated page containers. */
@Component({ selector: 'skoolo-action-feedback', template: '', styles: ':host { display: none; }' })
export class ActionFeedbackComponent {
  readonly success = input<string | null | undefined>('');
  readonly error = input<string | null | undefined>('');
  readonly pending = input(false);
  readonly pendingText = input('Working…');
  private readonly feedback = inject(ActionFeedbackService);
  private source = this.feedback.source();
  private wasPending = false;
  private previousSuccess: string | null | undefined;
  private suppressedSuccess: string | null | undefined;

  constructor() {
    effect(() => {
      const pending = this.pending(), success = this.success(), error = this.error(), pendingText = this.pendingText();
      untracked(() => {
        if (pending && !this.wasPending) {
          this.feedback.remove(this.source.id); this.source = this.feedback.source();
          this.previousSuccess = success; this.suppressedSuccess = undefined;
        }
        if (this.wasPending && !pending && success === this.previousSuccess) this.suppressedSuccess = success;
        if (!success) this.suppressedSuccess = undefined;
        this.wasPending = pending;
        if (pending) this.feedback.show(this.source, 'pending', pendingText);
        else if (error) this.feedback.show(this.source, 'error', error);
        else if (success && success !== this.suppressedSuccess) this.feedback.show(this.source, 'success', success);
        else this.feedback.remove(this.source.id);
      });
    });
    inject(DestroyRef).onDestroy(() => this.feedback.remove(this.source.id));
  }
}
