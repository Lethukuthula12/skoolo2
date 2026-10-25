import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { AuthLayoutComponent, AuthService, AuthChallengeComponent } from '@skoolo/shared';
import { InstallHintComponent } from '../directory/install-hint.component';

type Mode = 'sign_in' | 'sign_up';

@Component({
  selector: 'app-auth-page',
  imports: [
    ReactiveFormsModule, RouterLink, AuthLayoutComponent, AuthChallengeComponent, InstallHintComponent,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar,
  ],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss',
})
export class AuthPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  protected readonly challenge = viewChild(AuthChallengeComponent);

  protected readonly mode = signal<Mode>('sign_in');
  protected readonly passwordVisible = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly challengeActive = signal(true);

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

  protected switchMode(mode: Mode): void {
    if (this.busy()) return;
    this.mode.set(mode);
    this.passwordVisible.set(false);
    this.error.set(null);
    this.notice.set(null);
  }

  protected async signIn(): Promise<void> {
    if (this.signInForm.invalid || this.busy()) return;
    const challenge = this.challenge();
    const captchaToken = challenge?.takeToken();
    if (!captchaToken) { this.error.set('Please complete the security check.'); return; }
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.signInForm.getRawValue();
    try {
      const error = await this.auth.signIn(email.trim(), password, captchaToken);
      if (error) {
        this.error.set(error.code === 'invalid_credentials' || error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message);
        return;
      }
      this.signInForm.controls.password.reset();
      this.passwordVisible.set(false);
      await this.continueToReturnUrl();
    } catch {
      this.error.set('We could not finish signing you in. Please try again.');
    } finally {
      challenge?.reset();
      this.busy.set(false);
    }
  }

  protected async signUp(): Promise<void> {
    if (this.signUpForm.invalid || this.busy()) return;
    const challenge = this.challenge();
    const captchaToken = challenge?.takeToken();
    if (!captchaToken) { this.error.set('Please complete the security check.'); return; }
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    const value = this.signUpForm.getRawValue();
    try {
      const { error, needsEmailConfirmation } = await this.auth.signUp({
        email: value.email.trim(),
        password: value.password,
        fullName: value.fullName.trim(),
        phone: value.phone.trim(),
        emailRedirectTo: window.location.origin + '/auth',
        captchaToken,
      });
      if (error) {
        this.error.set(error.message);
        return;
      }
      this.signUpForm.controls.password.reset();
      this.passwordVisible.set(false);
      if (needsEmailConfirmation) {
        this.notice.set('Almost there. We sent a confirmation link to your email. Open it, then sign in.');
        this.mode.set('sign_in');
        this.signInForm.patchValue({ email: value.email.trim(), password: '' });
        return;
      }
      await this.continueToReturnUrl();
    } catch {
      this.error.set('We could not finish creating your login. Please try again.');
    } finally {
      challenge?.reset();
      this.busy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }

  ionViewWillEnter(): void { this.challengeActive.set(true); }
  ionViewWillLeave(): void {
    this.challengeActive.set(false);
    this.signInForm.controls.password.reset();
    this.signUpForm.controls.password.reset();
    this.passwordVisible.set(false);
  }

  private async continueToReturnUrl(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    await this.router.navigateByUrl(returnUrl);
  }
}
