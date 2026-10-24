import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { AuthLayoutComponent, AuthService } from '@skoolo/shared';

type Mode = 'sign_in' | 'sign_up';

@Component({
  selector: 'app-auth-page',
  imports: [
    ReactiveFormsModule, RouterLink, AuthLayoutComponent,
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

  protected readonly mode = signal<Mode>('sign_in');
  protected readonly passwordVisible = signal(false);
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

  protected switchMode(mode: Mode): void {
    this.mode.set(mode);
    this.passwordVisible.set(false);
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
