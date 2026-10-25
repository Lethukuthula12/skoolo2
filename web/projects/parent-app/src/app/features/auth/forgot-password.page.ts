import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService, AuthChallengeComponent } from '@skoolo/shared';

@Component({
  selector: 'app-forgot-password-page',
  imports: [
    ReactiveFormsModule, RouterLink, AuthChallengeComponent,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/auth" text="" /></ion-buttons>
        <ion-title>Reset password</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @if (sent()) {
        <div class="form-card">
          <h2>Check your email</h2>
          <p>If an account exists for {{ form.value.email }}, we have sent a link to reset your password. Open it on this phone and choose a new password.</p>
          <ion-button expand="block" fill="outline" routerLink="/auth">Back</ion-button>
        </div>
      } @else {
        <form class="form-card" [formGroup]="form" (ngSubmit)="submit()">
          <h2>Forgot your password?</h2>
          <p class="hint">Enter your email and we will send you a link to set a new one.</p>
          <ion-input label="Email" labelPlacement="floating" fill="outline" formControlName="email" type="email" inputmode="email" autocomplete="email" />
          @if (challengeActive()) { <skoolo-auth-challenge /> }
          @if (error()) { <p class="error-text">{{ error() }}</p> }
          <ion-button expand="block" size="large" type="submit" [disabled]="form.invalid || busy() || !challenge()?.verified()">
            @if (busy()) { <ion-spinner name="crescent" /> } @else { Send reset link }
          </ion-button>
        </form>
      }
    </ion-content>
  `,
  styles: `
    .form-card { display: grid; gap: 14px; }
    h2 { margin: 0; font-size: 1.3rem; font-weight: 700; }
    .hint { margin: -6px 0 0; color: var(--skoolo-muted); font-size: 0.92rem; }
    ion-button[type='submit'] { margin-top: 6px; --border-radius: 12px; font-weight: 700; }
  `,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  protected readonly challenge = viewChild(AuthChallengeComponent);

  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly challengeActive = signal(true);
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ionViewWillEnter(): void { this.challengeActive.set(true); }
  ionViewWillLeave(): void { this.challengeActive.set(false); }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy() || this.sent()) return;
    const challenge = this.challenge();
    const captchaToken = challenge?.takeToken();
    if (!captchaToken) { this.error.set('Please complete the security check.'); return; }
    this.busy.set(true);
    this.error.set(null);
    const redirectTo = `${location.origin}/reset-password`;
    try {
      const error = await this.auth.requestPasswordReset(this.form.getRawValue().email, redirectTo, captchaToken);
      // Keep account-specific responses indistinguishable, but do not claim delivery after a
      // failed security check, provider outage or rejected request.
      if (error && !['user_not_found', 'user_banned', 'email_not_confirmed'].includes(error.code ?? '')) {
        const rateLimited = error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit';
        this.error.set(rateLimited
          ? 'Too many attempts. Please wait a few minutes before trying again.'
          : 'We could not request a reset link. Please try again.');
        return;
      }
      this.sent.set(true);
    } catch {
      this.error.set('We could not request a reset link. Check your connection and try again.');
    } finally {
      challenge?.reset();
      this.busy.set(false);
    }
  }
}
