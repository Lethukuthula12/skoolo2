import { Component, DestroyRef, effect, inject, input, untracked } from '@angular/core';
import { ActionFeedbackService } from './action-feedback.service';

@Component({
  selector: 'skoolo-feedback-outlet',
  template: `
    @if (feedback.activeOutlet() === id) {
    <div class="feedback-stack" aria-label="Action notifications">
      @for (notice of feedback.notices(); track notice.id) {
        <div class="feedback-card" [class.success]="notice.kind === 'success'" [class.error]="notice.kind === 'error'"
          [class.pending]="notice.kind === 'pending'" [class.leaving]="notice.leaving"
          [attr.role]="notice.kind === 'error' ? 'alert' : 'status'" aria-atomic="true"
          (mouseenter)="feedback.pause(notice.id, 'pointer')" (mouseleave)="feedback.resume(notice.id, 'pointer')"
          (focusin)="feedback.pause(notice.id, 'focus')" (focusout)="feedback.resume(notice.id, 'focus')">
          <span class="feedback-icon" aria-hidden="true">
            @switch (notice.kind) {
              @case ('pending') { <span class="spinner"></span> }
              @case ('success') { <svg viewBox="0 0 24 24"><path class="check" d="m5 12 4 4L19 6" /></svg> }
              @case ('error') { <svg viewBox="0 0 24 24"><path d="M12 6v7m0 4v.1" /></svg> }
            }
          </span>
          <div class="feedback-copy"><strong>{{ notice.kind === 'pending' ? 'In progress' : notice.kind === 'success' ? 'Done' : 'Please check' }}</strong><p>{{ notice.message }}</p></div>
          <button class="feedback-close" type="button" aria-label="Dismiss notification" (click)="feedback.dismiss(notice.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
          @if (notice.kind === 'success') { <span class="duration" aria-hidden="true" [style.animation-play-state]="notice.paused ? 'paused' : 'running'"></span> }
        </div>
      }
    </div>
    }
  `,
  styleUrl: './feedback-outlet.component.scss',
})
export class FeedbackOutletComponent {
  readonly active = input(true);
  readonly priority = input(0);
  protected readonly feedback = inject(ActionFeedbackService);
  protected readonly id = this.feedback.outletId();
  constructor() {
    effect(() => {
      const active = this.active(), priority = this.priority();
      untracked(() => this.feedback.setOutlet(this.id, active, priority));
    });
    inject(DestroyRef).onDestroy(() => this.feedback.setOutlet(this.id, false, 0));
  }
}
