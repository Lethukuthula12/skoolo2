import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent, AuthService, StaffService, AuthChallengeComponent } from '@skoolo/shared';

@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, AuthChallengeComponent],
  templateUrl: './sign-in.page.html',
})
export class SignInPage {
  private readonly auth = inject(AuthService);
  private readonly staff = inject(StaffService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  protected readonly challenge = viewChild(AuthChallengeComponent);

  protected readonly passwordVisible = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async signIn(): Promise<void> {
    if (this.form.invalid || this.busy()) return;
    const challenge = this.challenge();
    const captchaToken = challenge?.takeToken();
    if (!captchaToken) { this.error.set('Please complete the security check.'); return; }
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      const error = await this.auth.signIn(email.trim(), password, captchaToken);
      if (error) {
        this.error.set(error.code === 'invalid_credentials' || error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message);
        return;
      }
      this.form.controls.password.reset();
      this.passwordVisible.set(false);
      this.staff.reset();
      const schools = await this.staff.loadSchools();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/applications';
      const isOnboarding = returnUrl === '/register-school' || returnUrl === '/join' || returnUrl.startsWith('/join?');
      if (schools.length === 0 && !isOnboarding) {
        await this.router.navigateByUrl('/no-school');
        return;
      }
      await this.router.navigateByUrl(returnUrl);
    } catch {
      this.error.set('We could not finish signing you in. Please try again.');
    } finally {
      challenge?.reset();
      this.busy.set(false);
    }
  }
}
