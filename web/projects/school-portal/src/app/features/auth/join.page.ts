import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, StaffService } from '@skoolo/shared';

/**
 * A staff member redeems the invite code their school gave them. New people create their login
 * here first; people who already have one just enter the code.
 */
@Component({
  selector: 'app-join-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="card stack">
        <div class="brand">Skoolo <span>for schools</span></div>
        <h1>Join your school</h1>
        <p class="muted">Enter the invite code your school gave you. Use the same email address the invite was made for.</p>

        @if (auth.isSignedIn()) {
          <p class="small">Signed in as <strong>{{ auth.user()?.email }}</strong>. <a href="#" (click)="switchAccount($event)">Not you?</a></p>
          <form class="stack" [formGroup]="codeForm" (ngSubmit)="redeem()">
            <div class="field">
              <label for="code">Invite code</label>
              <input id="code" type="text" formControlName="code" autocomplete="off" class="code" placeholder="e.g. 7K3M9QAB" />
            </div>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn btn-primary" type="submit" [disabled]="codeForm.invalid || busy()">{{ busy() ? 'Joining…' : 'Join school' }}</button>
          </form>
        } @else {
          @if (notice()) { <p class="auth-notice" role="status">{{ notice() }}</p> }
          <form class="stack" [formGroup]="signUpForm" (ngSubmit)="signUpAndRedeem()">
            <div class="field">
              <label for="code">Invite code</label>
              <input id="code" type="text" formControlName="code" autocomplete="off" class="code" placeholder="e.g. 7K3M9QAB" />
            </div>
            <div class="field"><label for="fullName">Your full name</label><input id="fullName" type="text" formControlName="fullName" autocomplete="name" /></div>
            <div class="field"><label for="phone">Cellphone</label><input id="phone" type="tel" formControlName="phone" autocomplete="tel" /></div>
            <div class="field"><label for="email">Email (the one the invite was made for)</label><input id="email" type="email" formControlName="email" autocomplete="email" /></div>
            <div class="field"><label for="password">Choose a password</label><input id="password" type="password" formControlName="password" autocomplete="new-password" /></div>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button class="btn btn-primary" type="submit" [disabled]="signUpForm.invalid || busy()">{{ busy() ? 'Creating your login…' : 'Create login and join' }}</button>
            <p class="small muted">Already have a Skoolo login? <a routerLink="/sign-in" [queryParams]="{ returnUrl: '/join?code=' + (signUpForm.value.code || '') }">Sign in first</a>, then enter the code.</p>
          </form>
        }
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: 100%; max-width: 440px; }
    .brand { font-weight: 800; font-size: 1.3rem; color: var(--brand); }
    .brand span { font-weight: 500; color: var(--muted); font-size: 1rem; }
    .code { text-transform: uppercase; letter-spacing: 0.12em; font-family: ui-monospace, Consolas, monospace; }
  `,
})
export class JoinPage {
  protected readonly auth = inject(AuthService);
  private readonly staff = inject(StaffService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly codeForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly signUpForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^(\+27|0)\d{9}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    const code = this.route.snapshot.queryParamMap.get('code') ?? '';
    this.codeForm.patchValue({ code });
    this.signUpForm.patchValue({ code });
  }

  protected async redeem(): Promise<void> {
    if (this.codeForm.invalid || this.busy() || !this.auth.isSignedIn()) return;
    await this.run(async () => {
      await this.staff.acceptInvite(this.codeForm.getRawValue().code);
    });
  }

  protected async signUpAndRedeem(): Promise<void> {
    if (this.signUpForm.invalid || this.busy()) return;
    const v = this.signUpForm.getRawValue();
    this.codeForm.patchValue({ code: v.code });
    this.notice.set(null);
    await this.run(async () => {
      const { error, needsEmailConfirmation } = await this.auth.signUp({
        email: v.email.trim(),
        password: v.password,
        fullName: v.fullName.trim(),
        phone: v.phone.trim(),
        emailRedirectTo: window.location.origin + '/join',
      });
      if (error) throw error;
      if (needsEmailConfirmation) {
        this.notice.set('Check your email for a confirmation link. Open it, then enter your school’s invite code to finish joining. Your invitation has not been used yet.');
        this.signUpForm.controls.password.reset();
        return false;
      }
      await this.staff.acceptInvite(v.code);
      return undefined;
    });
  }

  protected async switchAccount(event: Event): Promise<void> {
    event.preventDefault();
    await this.auth.signOut();
    this.staff.reset();
  }

  private async run(action: () => Promise<void | false>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      if (await action() === false) return;
      await this.router.navigateByUrl('/applications');
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }
}
