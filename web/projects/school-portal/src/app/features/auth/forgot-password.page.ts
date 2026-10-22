import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@skoolo/shared';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="card stack">
        <div class="brand">Skoolo <span>for schools</span></div>
        @if (sent()) {
          <h1>Check your email</h1>
          <p class="muted">
            If an account exists for <strong>{{ form.value.email }}</strong>, we have sent a link to reset your
            password. Open it on this device and choose a new password.
          </p>
          <a routerLink="/sign-in" class="btn btn-outline">Back to sign in</a>
        } @else {
          <h1>Reset your password</h1>
          <p class="muted">Enter your email and we will send you a link to set a new password.</p>
          <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" formControlName="email" autocomplete="email" />
            </div>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid || busy()">
              {{ busy() ? 'Sending…' : 'Send reset link' }}
            </button>
            <a routerLink="/sign-in" class="small muted">Back to sign in</a>
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
  `,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const redirectTo = `${location.origin}/reset-password`;
    const error = await this.auth.requestPasswordReset(this.form.getRawValue().email, redirectTo);
    this.busy.set(false);
    // Do not reveal whether the address exists; always show the same confirmation unless the
    // request itself failed to send (network, rate limit).
    if (error && /rate|network|fetch/i.test(error.message)) {
      this.error.set('Too many attempts or no connection. Please try again in a few minutes.');
      return;
    }
    this.sent.set(true);
  }
}
