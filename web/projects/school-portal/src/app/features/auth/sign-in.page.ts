import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, StaffService } from '@skoolo/shared';

@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="wrap">
      <form class="card" [formGroup]="form" (ngSubmit)="signIn()">
        <div class="brand">Skoolo <span>for schools</span></div>
        <h1>Sign in</h1>
        <p class="muted">Use the staff account your school was set up with.</p>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="btn btn-primary" type="submit" [disabled]="form.invalid || busy()">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: 100%; max-width: 400px; display: grid; gap: 14px; }
    .brand { font-weight: 800; font-size: 1.3rem; color: var(--brand); }
    .brand span { font-weight: 500; color: var(--muted); font-size: 1rem; }
    .btn { margin-top: 6px; }
  `,
})
export class SignInPage {
  private readonly auth = inject(AuthService);
  private readonly staff = inject(StaffService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async signIn(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    const error = await this.auth.signIn(email.trim(), password);
    if (error) {
      this.busy.set(false);
      this.error.set(error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message);
      return;
    }
    this.staff.reset();
    const schools = await this.staff.loadSchools();
    this.busy.set(false);
    if (schools.length === 0) {
      await this.router.navigateByUrl('/no-school');
      return;
    }
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/applications';
    await this.router.navigateByUrl(returnUrl);
  }
}
