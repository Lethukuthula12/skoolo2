import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent, AuthService, StaffService } from '@skoolo/shared';

@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent],
  templateUrl: './sign-in.page.html',
})
export class SignInPage {
  private readonly auth = inject(AuthService);
  private readonly staff = inject(StaffService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly passwordVisible = signal(false);
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
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/applications';
    const isOnboarding = returnUrl === '/register-school' || returnUrl === '/join' || returnUrl.startsWith('/join?');
    if (schools.length === 0 && !isOnboarding) {
      await this.router.navigateByUrl('/no-school');
      return;
    }
    await this.router.navigateByUrl(returnUrl);
  }
}
