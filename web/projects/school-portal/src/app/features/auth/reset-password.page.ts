import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
        } @else if (!canReset()) {
          <h1>This link has expired</h1>
          <p class="muted">Password-reset links can only be used once and expire after a while. Please request a new one.</p>
          <a routerLink="/forgot-password" class="btn btn-primary">Request a new link</a>
        } @else if (done()) {
          <h1>Password changed</h1>
          <p class="muted">You can now sign in with your new password.</p>
          <a routerLink="/sign-in" class="btn btn-primary">Sign in</a>
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
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid || busy()">
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
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
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
    // Give Supabase a moment to parse the recovery token from the URL.
    this.auth.whenReady().then(() => setTimeout(() => this.ready.set(true), 400));
  }

  protected async submit(): Promise<void> {
    if (this.form.hasError('mismatch')) {
      this.error.set('The two passwords do not match.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const error = await this.auth.updatePassword(this.form.getRawValue().password);
    this.busy.set(false);
    if (error) {
      this.error.set(error.message);
      return;
    }
    await this.auth.signOut();
    this.done.set(true);
  }
}
