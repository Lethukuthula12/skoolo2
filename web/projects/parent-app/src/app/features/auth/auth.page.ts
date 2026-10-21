import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSegment,
  IonSegmentButton, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import type { SegmentCustomEvent } from '@ionic/angular/standalone';
import { AuthService } from '@skoolo/shared';

type Mode = 'sign_in' | 'sign_up';

@Component({
  selector: 'app-auth-page',
  imports: [
    ReactiveFormsModule, RouterLink,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSegment,
    IonSegmentButton, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="/" text="" /></ion-buttons>
        <ion-title>{{ auth.isSignedIn() ? 'Your account' : 'Welcome' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (auth.isSignedIn()) {
        <div class="form-card account">
          <ion-icon name="person-circle-outline" class="avatar" />
          <h2>{{ auth.user()?.user_metadata?.['full_name'] || 'Parent' }}</h2>
          <p>{{ auth.user()?.email }}</p>
          <ion-button expand="block" fill="outline" routerLink="/inbox">
            <ion-icon slot="start" name="mail-outline" /> Messages
          </ion-button>
          <ion-button expand="block" fill="clear" color="medium" (click)="signOut()">
            <ion-icon slot="start" name="log-out-outline" /> Sign out
          </ion-button>
        </div>
      } @else {
        <div class="form-card">
          <ion-segment [value]="mode()" (ionChange)="switchMode($event)">
            <ion-segment-button value="sign_in">Sign in</ion-segment-button>
            <ion-segment-button value="sign_up">Create account</ion-segment-button>
          </ion-segment>

          @if (mode() === 'sign_up') {
            <p class="intro">Create a free parent account to apply to schools and follow your applications.</p>
            <form [formGroup]="signUpForm" (ngSubmit)="signUp()">
              <ion-input label="Your full name" labelPlacement="floating" fill="outline" formControlName="fullName" autocomplete="name" />
              <ion-input label="Cellphone number" labelPlacement="floating" fill="outline" formControlName="phone" type="tel" inputmode="tel" autocomplete="tel" helperText="The school uses this to contact you" />
              <ion-input label="Email" labelPlacement="floating" fill="outline" formControlName="email" type="email" inputmode="email" autocomplete="email" />
              <ion-input label="Password" labelPlacement="floating" fill="outline" formControlName="password" type="password" autocomplete="new-password" helperText="At least 8 characters" />
              @if (error()) { <p class="error-text">{{ error() }}</p> }
              @if (notice()) { <p class="notice-text">{{ notice() }}</p> }
              <ion-button expand="block" size="large" type="submit" [disabled]="signUpForm.invalid || busy()">
                @if (busy()) { <ion-spinner name="crescent" /> } @else { Create account }
              </ion-button>
            </form>
          } @else {
            <form [formGroup]="signInForm" (ngSubmit)="signIn()">
              <ion-input label="Email" labelPlacement="floating" fill="outline" formControlName="email" type="email" inputmode="email" autocomplete="email" />
              <ion-input label="Password" labelPlacement="floating" fill="outline" formControlName="password" type="password" autocomplete="current-password" />
              @if (error()) { <p class="error-text">{{ error() }}</p> }
              <ion-button expand="block" size="large" type="submit" [disabled]="signInForm.invalid || busy()">
                @if (busy()) { <ion-spinner name="crescent" /> } @else { Sign in }
              </ion-button>
            </form>
          }
        </div>
      }
    </ion-content>
  `,
  styles: `
    form { display: grid; gap: 14px; margin-top: 16px; }
    ion-segment { margin-bottom: 4px; }
    .intro { color: rgba(20, 33, 61, 0.7); margin: 14px 0 0; font-size: 0.95rem; }
    .notice-text { color: var(--ion-color-success-shade); font-size: 0.9rem; margin: 0; }
    ion-button[type="submit"] { margin-top: 6px; --border-radius: 12px; font-weight: 700; }
    .account { text-align: center; }
    .account .avatar { font-size: 72px; color: var(--ion-color-primary); }
    .account h2 { margin: 4px 0 0; }
    .account p { color: rgba(20, 33, 61, 0.7); margin: 4px 0 20px; }
  `,
})
export class AuthPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly mode = signal<Mode>('sign_in');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly signInForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly signUpForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^(\+27|0)\d{9}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    if (this.route.snapshot.queryParamMap.get('mode') === 'sign_up') {
      this.mode.set('sign_up');
    }
  }

  protected switchMode(event: SegmentCustomEvent): void {
    this.mode.set((event.detail.value as Mode) ?? 'sign_in');
    this.error.set(null);
    this.notice.set(null);
  }

  protected async signIn(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.signInForm.getRawValue();
    const error = await this.auth.signIn(email.trim(), password);
    this.busy.set(false);
    if (error) {
      this.error.set(error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message);
      return;
    }
    this.continueToReturnUrl();
  }

  protected async signUp(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    const value = this.signUpForm.getRawValue();
    const { error, needsEmailConfirmation } = await this.auth.signUp({
      email: value.email.trim(),
      password: value.password,
      fullName: value.fullName.trim(),
      phone: value.phone.trim(),
    });
    this.busy.set(false);
    if (error) {
      this.error.set(error.message);
      return;
    }
    if (needsEmailConfirmation) {
      this.notice.set('Almost there. We sent a confirmation link to your email. Open it, then sign in.');
      this.mode.set('sign_in');
      this.signInForm.patchValue({ email: value.email.trim() });
      return;
    }
    this.continueToReturnUrl();
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }

  private continueToReturnUrl(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    void this.router.navigateByUrl(returnUrl);
  }
}
