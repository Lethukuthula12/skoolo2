import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AuthService } from './auth.service';
import { AuthLayoutComponent } from './auth-layout.component';

/** A full-page boundary. Its normal link starts a fresh app without any previous account's pages. */
@Component({
  selector: 'skoolo-session-ended',
  imports: [AuthLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <skoolo-auth-layout [audience]="audience()">
      <div class="session-message" role="status" aria-live="polite">
        <h1>{{ title() }}</h1>
        @if (auth.signingOut()) {
          <p>Closing your session. Your account pages have been cleared.</p>
        } @else if (auth.signOutFailed()) {
          @if (auth.session()) {
            <p>We couldn't complete sign-out. Your account pages are hidden. Check your connection and try again.</p>
            <button type="button" (click)="auth.signOut()">Retry sign out</button>
          } @else {
            <p>You are signed out of this browser. We couldn't confirm sign-out on other devices. Sign in again to retry signing out everywhere.</p>
            <a [href]="signInUrl()">Continue to sign in</a>
          }
        } @else {
          <p>{{ description() }}</p>
          <a [href]="continueUrl()">{{ auth.boundary() === 'signed-out' || auth.boundary() === 'password-changed' ? 'Continue to sign in' : 'Continue' }}</a>
        }
      </div>
    </skoolo-auth-layout>
  `,
  styles: `
    :host { display: block; height: 100%; overflow: auto; }
    .session-message { max-width: 440px; color: var(--auth-ink, #303972); }
    h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.2; margin: 0 0 20px; }
    p { line-height: 1.7; margin: 0 0 28px; }
    a, button { display: inline-block; padding: 14px 24px; border: 0; border-radius: 12px;
      background: #4d44b5; color: white; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
    a:focus-visible, button:focus-visible { outline: 3px solid #fb7d5b; outline-offset: 4px; }
  `,
})
export class SessionEndedComponent {
  protected readonly auth = inject(AuthService);
  readonly audience = input<'parent' | 'school'>('school');
  protected readonly signInUrl = computed(() => this.audience() === 'school' ? '/sign-in' : '/auth');
  protected readonly continueUrl = computed(() => {
    const reason = this.auth.boundary();
    return reason === 'account-changed' || reason === 'session-expired' || reason === 'restore-failed'
      ? (this.audience() === 'school' ? '/school' : '/') : this.signInUrl();
  });
  protected readonly title = computed(() => {
    if (this.auth.signingOut()) return 'Signing out…';
    if (this.auth.signOutFailed()) return 'Sign-out needs attention';
    switch (this.auth.boundary()) {
      case 'signed-out': return 'You’re signed out.';
      case 'password-changed': return 'Password changed.';
      case 'account-changed': return 'Your account has changed.';
      case 'restore-failed': return 'We couldn’t restore your session.';
      default: return 'Your session has ended.';
    }
  });
  protected readonly description = computed(() => {
    switch (this.auth.boundary()) {
      case 'signed-out': return 'Your account pages have been cleared. You can sign in again when you’re ready.';
      case 'password-changed': return 'Your new password is saved. Sign in with it to continue.';
      case 'account-changed': return 'Continue to load a fresh workspace for the current account.';
      case 'restore-failed': return 'Check your connection and continue to try again.';
      default: return 'Your account pages have been cleared. Connect to the internet and continue to sign in or renew your session.';
    }
  });
}
