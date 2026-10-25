import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { StaffSessionTimeoutService } from './staff-session-timeout.service';

/** Mount once inside a staff-only shell; the idle/absolute limits are not enforced if this is absent. */
@Component({
  selector: 'skoolo-staff-session-warning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (timeout.warning(); as warning) {
      <div class="staff-session-warning" role="alertdialog" aria-live="assertive" aria-label="Session ending soon">
        <p>{{ message(warning) }}</p>
        <div class="actions">
          <button type="button" (click)="timeout.stayActive()">Stay signed in</button>
          <button type="button" class="ghost" (click)="auth.signOut()">Sign out now</button>
        </div>
      </div>
    }
  `,
  styles: `
    .staff-session-warning { position: fixed; z-index: 1000; right: 20px; bottom: 20px; max-width: 320px;
      background: #26204f; color: white; padding: 18px 20px; border-radius: 14px; box-shadow: 0 12px 32px rgba(0, 0, 0, .28); }
    p { margin: 0 0 14px; line-height: 1.5; }
    .actions { display: flex; gap: 10px; }
    button { border: 0; border-radius: 10px; padding: 10px 14px; font: inherit; font-weight: 600; cursor: pointer; }
    button:first-child { background: #fb7d5b; color: #221c3f; }
    button.ghost { background: transparent; color: white; border: 1px solid rgba(255, 255, 255, .5); }
    button:focus-visible { outline: 3px solid #fb7d5b; outline-offset: 3px; }
    @media (max-width: 480px) { .staff-session-warning { left: 16px; right: 16px; max-width: none; bottom: 16px; } }
  `,
})
export class StaffSessionWarningComponent {
  protected readonly timeout = inject(StaffSessionTimeoutService);
  protected readonly auth = inject(AuthService);

  protected message(warning: { reason: 'idle' | 'session'; secondsRemaining: number }): string {
    const minutes = Math.floor(warning.secondsRemaining / 60);
    const seconds = warning.secondsRemaining % 60;
    const time = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return warning.reason === 'idle'
      ? `You'll be signed out in ${time} due to inactivity.`
      : `You'll be signed out in ${time}: the 8-hour staff session limit is ending.`;
  }
}
