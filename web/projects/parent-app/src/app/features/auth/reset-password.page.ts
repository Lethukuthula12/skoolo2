import { Component, computed, inject, signal } from '@angular/core';
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
          @if (error()) { <p class="error-text">{{ error() }}</p> }
          <ion-button expand="block" size="large" type="submit" [disabled]="form.invalid || busy()">
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
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canReset = computed(() => this.auth.isPasswordRecovery() || this.auth.isSignedIn());

  protected readonly form = this.formBuilder.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: (group) => (group.value.password === group.value.confirm ? null : { mismatch: true }) },
  );

  constructor() {
    this.auth.whenReady().then(() => setTimeout(() => this.ready.set(true), 400));
  }

  protected async submit(): Promise<void> {
    if (this.busy() || this.done() || !this.ready() || !this.canReset()) return;
    if (this.form.hasError('mismatch')) {
      this.error.set('The two passwords do not match.');
      return;
    }
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const error = await this.auth.updatePassword(this.form.getRawValue().password);
    this.busy.set(false);
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.form.reset();
    await this.auth.signOut('password-changed');
    this.done.set(true);
  }
}
