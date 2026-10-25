import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonInput, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '@skoolo/shared';

/** Where the password-reset email link lands in the parent app. */
@Component({
  selector: 'app-reset-password-page',
  imports: [
    ReactiveFormsModule, RouterLink,
    IonButton, IonContent, IonHeader, IonInput, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>Reset password</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      @if (!ready()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (done()) {
        <div class="form-card">
          <h2>Password changed</h2>
          <p>You can now sign in with your new password.</p>
          <ion-button expand="block" routerLink="/auth">Sign in</ion-button>
        </div>
      } @else if (!canReset()) {
        <div class="form-card">
          <h2>This link has expired</h2>
          <p>Reset links can only be used once and expire after a while. Please request a new one.</p>
          <ion-button expand="block" routerLink="/auth">Back to sign in</ion-button>
        </div>
      } @else {
        <form class="form-card" [formGroup]="form" (ngSubmit)="submit()">
          <h2>Choose a new password</h2>
          <ion-input label="New password" labelPlacement="floating" fill="outline" formControlName="password" type="password" autocomplete="new-password" helperText="At least 8 characters" />
          <ion-input label="Confirm new password" labelPlacement="floating" fill="outline" formControlName="confirm" type="password" autocomplete="new-password" />
          @if (needsVerification()) {
            <div class="verification">
              <p id="verification-help" role="status">Verify your identity to finish changing your password. Send a code to your account email, then enter it below.</p>
              <ion-button expand="block" fill="outline" type="button" (click)="sendCode()" [disabled]="busy() || sendingCode() || resendSeconds() > 0">
                {{ sendingCode() ? 'Sending code…' : resendSeconds() > 0 ? 'Send again in ' + resendSeconds() + 's' : codeSent() ? 'Send another code' : 'Send verification code' }}
              </ion-button>
              @if (codeSent()) { <p role="status">Code sent. Check your inbox and spam folder.</p> }
              <ion-input label="Verification code" labelPlacement="floating" fill="outline" type="text" inputmode="numeric" autocomplete="one-time-code" aria-describedby="verification-help" [formControl]="verificationCode" />
            </div>
          }
          @if (error()) { <p class="error-text" role="alert">{{ error() }}</p> }
          <ion-button expand="block" size="large" type="submit" [disabled]="form.invalid || busy() || sendingCode() || (needsVerification() && !verificationCode.value.trim())">
            @if (busy()) { <ion-spinner name="crescent" /> } @else { Save new password }
          </ion-button>
        </form>
      }
    </ion-content>
  `,
  styles: `
    .form-card { display: grid; gap: 14px; }
    h2 { margin: 0; font-size: 1.3rem; font-weight: 700; }
    ion-button[type='submit'] { margin-top: 6px; --border-radius: 12px; font-weight: 700; }
    .verification { display: grid; gap: 14px; padding: 16px; border: 1px solid var(--ion-color-primary); border-radius: 12px; }
    .verification p { margin: 0; }
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);
  private resendTimer: ReturnType<typeof setInterval> | undefined;
  private viewActive = true;
  private viewVersion = 0;

  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly needsVerification = signal(false);
  protected readonly sendingCode = signal(false);
  protected readonly codeSent = signal(false);
  protected readonly resendSeconds = signal(0);
  protected readonly verificationCode = this.formBuilder.control('', Validators.required);
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
    this.auth.whenReady().then(() => setTimeout(() => this.ready.set(true), 400));
  }

  protected async submit(): Promise<void> {
    if (!this.viewActive || this.busy() || this.sendingCode() || this.done() || !this.ready() || !this.canReset()) return;
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
    const viewVersion = this.viewVersion;
    try {
      const error = await this.auth.updatePassword(this.form.getRawValue().password, nonce);
      if (this.destroyRef.destroyed || viewVersion !== this.viewVersion || !this.canReset()) return;
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
      if (!this.destroyRef.destroyed && viewVersion === this.viewVersion && this.canReset()) {
        this.error.set('We could not save your password. Check your connection and try again.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async sendCode(): Promise<void> {
    if (!this.viewActive || this.busy() || this.sendingCode() || this.done() || !this.ready() ||
        !this.canReset() || !this.needsVerification() || this.resendSeconds() > 0) return;
    this.sendingCode.set(true);
    this.error.set(null);
    const viewVersion = this.viewVersion;
    try {
      const error = await this.auth.requestPasswordChangeCode();
      if (this.destroyRef.destroyed || viewVersion !== this.viewVersion || !this.canReset()) return;
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
      if (!this.destroyRef.destroyed && viewVersion === this.viewVersion && this.canReset()) {
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

  ionViewWillEnter(): void {
    this.viewActive = true;
  }

  ionViewWillLeave(): void {
    // Ionic can retain a hidden page instead of destroying it.
    this.viewActive = false;
    ++this.viewVersion;
    this.form.reset();
    this.verificationCode.reset();
    this.needsVerification.set(false);
    this.codeSent.set(false);
    this.error.set(null);
    clearInterval(this.resendTimer);
    this.resendSeconds.set(0);
  }
}
