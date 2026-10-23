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
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/" text="" /></ion-buttons>
        <ion-title>{{ auth.isSignedIn() ? 'Your account' : 'Welcome' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (auth.isSignedIn()) {
        <div class="screen-intro"><p class="eyebrow">YOUR SPACE</p><h1>Home and school, connected.</h1><p>Your family, applications and conversations in one place.</p></div>
        <div class="form-card account">
          <div class="profile"><span class="avatar"><ion-icon name="person-circle-outline" aria-hidden="true" /></span><div><span class="profile-label">Parent account</span><h2>{{ auth.user()?.user_metadata?.['full_name'] || 'Parent' }}</h2><p>{{ auth.user()?.email }}</p></div></div>
          <nav class="account-links" aria-label="Account shortcuts">
            <a routerLink="/children"><ion-icon name="people-outline" aria-hidden="true" /><span><strong>My family</strong><small>Children, reports and school life</small></span><ion-icon name="chevron-forward-outline" aria-hidden="true" /></a>
            <a routerLink="/applications"><ion-icon name="folder-open-outline" aria-hidden="true" /><span><strong>Applications</strong><small>Follow your enrolment progress</small></span><ion-icon name="chevron-forward-outline" aria-hidden="true" /></a>
            <a routerLink="/inbox"><ion-icon name="mail-outline" aria-hidden="true" /><span><strong>Inbox</strong><small>Updates about your applications</small></span><ion-icon name="chevron-forward-outline" aria-hidden="true" /></a>
            <a routerLink="/schools"><ion-icon name="school-outline" aria-hidden="true" /><span><strong>Explore schools</strong><small>Find a place for their next chapter</small></span><ion-icon name="chevron-forward-outline" aria-hidden="true" /></a>
          </nav>
          <ion-button class="sign-out" fill="clear" color="medium" (click)="signOut()"><ion-icon slot="start" name="log-out-outline" /> Sign out</ion-button>
        </div>
      } @else {
        <div class="auth-intro"><span class="welcome-mark"><ion-icon name="school-outline" aria-hidden="true" /></span><p class="auth-wordmark">skoolo<span>.</span></p><h1>{{ mode() === 'sign_up' ? 'A new chapter starts here.' : 'Welcome back.' }}</h1><p>Your child’s school day, a little closer.</p></div>
        <div class="form-card auth-card">
          <ion-segment [value]="mode()" (ionChange)="switchMode($event)">
            <ion-segment-button value="sign_in">Sign in</ion-segment-button>
            <ion-segment-button value="sign_up">Create account</ion-segment-button>
          </ion-segment>
          @if (notice()) { <p class="notice-text" role="status">{{ notice() }}</p> }

          @if (mode() === 'sign_up') {
            <p class="intro">Create a free parent account to apply to schools and follow your applications.</p>
            <form [formGroup]="signUpForm" (ngSubmit)="signUp()">
              <ion-input label="Your full name" labelPlacement="floating" fill="outline" formControlName="fullName" autocomplete="name" />
              <ion-input label="Cellphone number" labelPlacement="floating" fill="outline" formControlName="phone" type="tel" inputmode="tel" autocomplete="tel" helperText="The school uses this to contact you" />
              <ion-input label="Email" labelPlacement="floating" fill="outline" formControlName="email" type="email" inputmode="email" autocomplete="email" />
              <ion-input label="Password" labelPlacement="floating" fill="outline" formControlName="password" type="password" autocomplete="new-password" helperText="At least 8 characters" />
              @if (error()) { <p class="error-text" role="alert">{{ error() }}</p> }
              <ion-button expand="block" size="large" type="submit" [disabled]="signUpForm.invalid || busy()">
                @if (busy()) { <ion-spinner name="crescent" /> } @else { Create account }
              </ion-button>
            </form>
          } @else {
            <form [formGroup]="signInForm" (ngSubmit)="signIn()">
              <ion-input label="Email" labelPlacement="floating" fill="outline" formControlName="email" type="email" inputmode="email" autocomplete="email" />
              <ion-input label="Password" labelPlacement="floating" fill="outline" formControlName="password" type="password" autocomplete="current-password" />
              @if (error()) { <p class="error-text" role="alert">{{ error() }}</p> }
              <ion-button expand="block" size="large" type="submit" [disabled]="signInForm.invalid || busy()">
                @if (busy()) { <ion-spinner name="crescent" /> } @else { Sign in }
              </ion-button>
              <ion-button fill="clear" size="small" routerLink="/forgot-password">Forgot password?</ion-button>
            </form>
          }
        </div>
      }
    </ion-content>
  `,
  styles: `
    form { display: grid; gap: 14px; margin-top: 16px; }
    ion-segment { margin-bottom: 4px; }
    .intro { color: var(--skoolo-muted); margin: 18px 0 0; font-size: 13px; }
    .notice-text { color: var(--ion-color-success-shade); font-size: 13px; margin: 16px 0 0; }
    ion-button[type="submit"] { margin-top: 6px; --border-radius: 12px; font-weight: 700; }
    .profile { display: flex; align-items: center; gap: 16px; padding: 6px 0 24px; }
    .profile > div { min-width: 0; }
    .profile .avatar { width: 64px; height: 64px; border-radius: 20px; flex-shrink: 0; display: grid; place-items: center; font-size: 38px; color: var(--skoolo-brand-ink); background: var(--skoolo-brand-soft); }
    .profile-label { color: var(--skoolo-brand-ink); font-size: 11px; }
    .profile h2 { margin: 4px 0 0; font-size: 19px; }
    .profile p { color: var(--skoolo-muted); margin: 4px 0 0; font-size: 12px; overflow-wrap: anywhere; }
    .account-links a { display: flex; align-items: center; gap: 15px; border-top: 1px solid var(--skoolo-line); padding: 19px 0; color: var(--skoolo-title); text-decoration: none; }
    .account-links ion-icon { font-size: 22px; flex-shrink: 0; color: var(--skoolo-brand-ink); }
    .account-links strong { display: block; font-size: 14px; font-weight: 500; }
    .account-links small { display: block; font-size: 11px; color: var(--skoolo-muted); margin-top: 5px; }
    .account-links ion-icon:last-child { margin-left: auto; font-size: 16px; color: var(--skoolo-muted); }
    .sign-out { margin: 8px 0 0; }
    .auth-intro { text-align: center; margin: 34px 24px 24px; }
    .welcome-mark { display: inline-grid; place-items: center; width: 52px; height: 52px; border-radius: 16px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); font-size: 30px; }
    .auth-wordmark { margin: 5px 0 20px !important; font-size: 26px !important; font-weight: 700; color: var(--skoolo-title) !important; letter-spacing: -1px; }
    .auth-wordmark span { color: var(--ion-color-secondary); }
    .auth-intro h1 { font-size: 27px; letter-spacing: -.7px; margin: 0 0 8px; }
    .auth-intro p { color: var(--skoolo-muted); font-size: 13px; margin: 0; }
    .auth-card { max-width: 440px; padding: 26px; }
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
