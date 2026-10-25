import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@skoolo/shared';

/**
 * Where the password-reset email link lands. Supabase turns the link into a recovery session, so a
 * session is present here; we let the user set a new password, then send them to sign in.
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="card stack">
        <div class="brand">Skoolo <span>for schools</span></div>
        @if (!ready()) {
          <p class="muted">Checking your link…</p>
        } @else if (done()) {
          <h1>Password changed</h1>
          <p class="muted">You can now sign in with your new password.</p>
          <a routerLink="/sign-in" class="btn btn-primary">Sign in</a>
        } @else if (!canReset()) {
          <h1>This link has expired</h1>
          <p class="muted">Password-reset links can only be used once and expire after a while. Please request a new one.</p>
          <a routerLink="/forgot-password" class="btn btn-primary">Request a new link</a>
        } @else {
          <h1>Choose a new password</h1>
          <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label for="password">New password</label>
              <input id="password" type="password" formControlName="password" autocomplete="new-password" />
            </div>
            <div class="field">
              <label for="confirm">Confirm new password</label>
              <input id="confirm" type="password" formControlName="confirm" autocomplete="new-password" />
            </div>
            @if (needsVerification()) {
              <div class="verification stack">
                <p id="verification-help" role="status">Verify your identity to finish changing your password. Send a code to your account email, then enter it below.</p>
                <button class="btn" type="button" (click)="sendCode()" [disabled]="busy() || sendingCode() || resendSeconds() > 0">
                  {{ sendingCode() ? 'Sending code…' : resendSeconds() > 0 ? 'Send again in ' + resendSeconds() + 's' : codeSent() ? 'Send another code' : 'Send verification code' }}
                </button>
                @if (codeSent()) { <p role="status">Code sent. Check your inbox and spam folder.</p> }
                <div class="field">
                  <label for="verification-code">Verification code</label>
                  <input id="verification-code" type="text" inputmode="numeric" autocomplete="one-time-code" aria-describedby="verification-help" [formControl]="verificationCode" />
                </div>
              </div>
            }
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid || busy() || sendingCode() || (needsVerification() && !verificationCode.value.trim())">
              {{ busy() ? 'Saving…' : 'Save new password' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: 100%; max-width: 400px; }
    .brand { font-weight: 800; font-size: 1.3rem; color: var(--brand); }
    .brand span { font-weight: 500; color: var(--muted); font-size: 1rem; }
    .verification { padding: 16px; border: 1px solid var(--brand); border-radius: 12px; }
    .verification p { margin: 0; }
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);
  private resendTimer: ReturnType<typeof setInterval> | undefined;

  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly needsVerification = signal(false);
  protected readonly sendingCode = signal(false);
  protected readonly codeSent = signal(false);
  protected readonly resendSeconds = signal(0);
  protected readonly verificationCode = this.formBuilder.control('', Validators.required);
  // A valid reset link produced a recovery session; allow the change while one exists.
  protected readonly canReset = computed(() => this.auth.isPasswordRecovery() || this.auth.isSignedIn());

  protected readonly form = this.formBuilder.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: (group) => (group.value.password === group.value.confirm ? null : { mismatch: true }) },
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearInterval(this.resendTimer);
      this.form.reset();
      this.verificationCode.reset();
    });
    // Give Supabase a moment to parse the recovery token from the URL.
    this.auth.whenReady().then(() => setTimeout(() => this.ready.set(true), 400));
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.sendingCode() || this.done() || !this.ready() || !this.canReset()) return;
    if (this.form.hasError('mismatch')) {
      this.error.set('The two passwords do not match.');
      return;
    }
    if (this.form.invalid) return;
    const nonce = this.needsVerification() ? this.verificationCode.value.trim() : undefined;
    if (this.needsVerification() && !nonce) {
      this.error.set('Enter the verification code from your email.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const error = await this.auth.updatePassword(this.form.getRawValue().password, nonce);
      if (this.destroyRef.destroyed || !this.canReset()) return;
      if (error) {
        if (error.code === 'reauthentication_needed' || error.code === 'reauth_nonce_missing') {
          this.needsVerification.set(true);
          this.verificationCode.reset();
        } else if (error.code === 'reauthentication_not_valid') {
          this.needsVerification.set(true);
          this.verificationCode.reset();
          this.error.set('That code is invalid or has expired. Try again or send a new code.');
        } else {
          this.error.set(error.message);
        }
        return;
      }
      this.form.reset();
      this.verificationCode.reset();
      await this.auth.signOut('password-changed');
      this.done.set(true);
    } catch {
      if (!this.destroyRef.destroyed && this.canReset()) {
        this.error.set('We could not save your password. Check your connection and try again.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async sendCode(): Promise<void> {
    if (this.busy() || this.sendingCode() || this.done() || !this.ready() ||
        !this.canReset() || !this.needsVerification() || this.resendSeconds() > 0) return;
    this.sendingCode.set(true);
    this.error.set(null);
    try {
      const error = await this.auth.requestPasswordChangeCode();
      if (this.destroyRef.destroyed || !this.canReset()) return;
      if (error) {
        const rateLimited = error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit';
        if (rateLimited) this.startResendCooldown();
        this.error.set(rateLimited
          ? 'Please wait before requesting another code. If it still fails, try again later.'
          : 'We could not send a code. Please try again.');
        return;
      }
      this.verificationCode.reset();
      this.codeSent.set(true);
      this.startResendCooldown();
    } catch {
      if (!this.destroyRef.destroyed && this.canReset()) {
        this.error.set('We could not send a code. Check your connection and try again.');
      }
    } finally {
      this.sendingCode.set(false);
    }
  }

  private startResendCooldown(): void {
    // This prevents accidental repeat clicks; Supabase must enforce actual request limits.
    clearInterval(this.resendTimer);
    this.resendSeconds.set(60);
    this.resendTimer = setInterval(() => {
      this.resendSeconds.update(seconds => Math.max(0, seconds - 1));
      if (this.resendSeconds() === 0) clearInterval(this.resendTimer);
    }, 1000);
  }
}
