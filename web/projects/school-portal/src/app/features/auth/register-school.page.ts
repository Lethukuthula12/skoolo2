import { Component, ElementRef, ViewChild, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, AuthChallengeComponent, Grade, PROVINCES, Province, School, SchoolDirectoryService, StaffService } from '@skoolo/shared';

/**
 * A principal or admin puts their school on Skoolo. Either they claim a school already in the
 * directory, or they register a new one. They become its first admin; Skoolo verifies it before
 * parents can apply.
 */
@Component({
  selector: 'app-register-school-page',
  imports: [ReactiveFormsModule, RouterLink, AuthChallengeComponent],
  template: `
    <div class="wrap">
      <div class="card stack">
        <div class="brand">Skoolo <span>for schools</span></div>
        <h1>Put your school on Skoolo</h1>
        <p class="muted">
          Free for schools. You become the school's administrator, invite your staff, open enrolment and
          receive applications from parents' phones.
        </p>

        @if (!auth.isSignedIn()) {
          @if (confirmationEmail(); as email) {
            <section #confirmationPanel class="confirmation-panel" tabindex="-1" aria-labelledby="confirmation-title">
              <span class="confirmation-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7" stroke-linejoin="round"/></svg>
              </span>
              <h2 id="confirmation-title">Check your email</h2>
              <p role="status">Check <strong>{{ email }}</strong> and open the confirmation link to continue.</p>
              <p>Once you confirm, you can add or claim your school.</p>
              <p class="small muted">Can't find it? Check your spam folder. If you already have a Skoolo login, sign in with that account.</p>
              <div class="confirmation-actions">
                <a class="btn btn-primary" routerLink="/sign-in" [queryParams]="{ returnUrl: '/register-school' }">Continue to sign in</a>
                <button class="btn btn-outline" type="button" (click)="editAccount()">Use a different email</button>
              </div>
            </section>
          } @else {
          <form class="stack" [formGroup]="accountForm" (ngSubmit)="createAccount()" [attr.aria-busy]="busy()">
            <h2>1. Your login</h2>
            <p class="small muted">Create and confirm your login first. You will add or claim your school next.</p>
            <div class="form-grid">
              <div class="field"><label for="fullName">Your full name</label><input id="fullName" type="text" formControlName="fullName" autocomplete="name" /></div>
              <div class="field"><label for="phone">Cellphone</label><input id="phone" type="tel" formControlName="phone" autocomplete="tel" /></div>
              <div class="field"><label for="email">Email</label><input id="email" type="email" formControlName="email" autocomplete="email" /></div>
              <div class="field">
                <label for="password">Choose a password</label>
                <div class="registration-password">
                  <input id="password" [type]="passwordVisible() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" aria-describedby="password-hint" />
                  <button class="registration-password-toggle" type="button" (click)="passwordVisible.set(!passwordVisible())" aria-controls="password" [attr.aria-label]="passwordVisible() ? 'Hide password' : 'Show password'">{{ passwordVisible() ? 'Hide' : 'Show' }}</button>
                </div>
                <small id="password-hint" class="muted">Use at least 8 characters.</small>
              </div>
            </div>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <skoolo-auth-challenge />
            <button class="btn btn-primary" type="submit" [disabled]="accountForm.invalid || busy() || !challenge()?.verified()">{{ busy() ? 'Creating your login…' : 'Create login and continue' }}</button>
            <p class="small muted">Already have a login? <a routerLink="/sign-in" [queryParams]="{ returnUrl: '/register-school' }">Sign in first</a>.</p>
          </form>
          }
        } @else {
          <p class="small">Signed in as <strong>{{ auth.user()?.email }}</strong>.</p>
        }

        @if (auth.isSignedIn()) {
        @if (savedSchool(); as school) {
          <section #savedPanel class="confirmation-panel" tabindex="-1" aria-labelledby="saved-title">
            <h2 id="saved-title">Your school is saved</h2>
            <p role="status"><strong>{{ school.name }}</strong> has been added to your account.</p>
            @if (workspaceUnavailable()) {
              <p>We couldn't open your workspace. Reload to continue — you don't need to register again.</p>
              <div class="confirmation-actions">
                <a class="btn btn-primary" [href]="schoolUrl()">Reload and continue</a>
              </div>
            } @else {
              <p role="status">Opening your school workspace…</p>
            }
          </section>
        } @else {
        <h2>Your school</h2>
        <div class="field">
          <label for="search">Is your school already listed? Search by name</label>
          <input id="search" type="text" [value]="searchTerm()" (input)="onSearch($event)" placeholder="Start typing the school's name" />
        </div>
        @if (matches().length > 0) {
          <ul class="matches">
            @for (s of matches(); track s.id) {
              <li>
                <div><strong>{{ s.name }}</strong><br /><span class="muted small">{{ s.town }}, {{ s.province }}</span></div>
                <button class="btn btn-outline btn-sm" type="button" (click)="claim(s)" [disabled]="busy()">This is my school</button>
              </li>
            }
          </ul>
        } @else if (searchTerm().length >= 2 && !searching()) {
          <p class="small muted">No unclaimed school by that name. Register it below.</p>
        }

        <form class="stack" [formGroup]="schoolForm" (ngSubmit)="register()">
          <div class="form-grid">
            <div class="field wide"><label for="name">School name</label><input id="name" type="text" formControlName="name" /></div>
            <div class="field"><label for="town">Town or suburb</label><input id="town" type="text" formControlName="town" /></div>
            <div class="field"><label for="province">Province</label>
              <select id="province" formControlName="province">
                <option value="">Choose…</option>
                @for (p of provinces; track p) { <option [value]="p">{{ p }}</option> }
              </select>
            </div>
            <div class="field"><label for="lowest">Lowest grade</label>
              <select id="lowest" formControlName="lowestGrade">
                @for (g of grades(); track g.code) { <option [value]="g.code">{{ g.label }}</option> }
              </select>
            </div>
            <div class="field"><label for="highest">Highest grade</label>
              <select id="highest" formControlName="highestGrade">
                @for (g of grades(); track g.code) { <option [value]="g.code">{{ g.label }}</option> }
              </select>
            </div>
            <div class="field"><label for="schoolPhone">School phone</label><input id="schoolPhone" type="tel" formControlName="phone" /></div>
            <div class="field"><label for="schoolEmail">School email</label><input id="schoolEmail" type="email" formControlName="email" /></div>
          </div>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn btn-primary" type="submit" [disabled]="schoolForm.invalid || busy()">
            {{ busy() ? 'Setting up…' : 'Register my school' }}
          </button>
          <p class="small muted">
            Skoolo checks that each new school is real before parents can apply to it. Until then you can set
            everything up: profile, badge, staff, enrolment period and grades.
          </p>
        </form>
        }
        }
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: 100%; max-width: 640px; }
    .brand { font-weight: 800; font-size: 1.3rem; color: var(--brand); }
    .brand span { font-weight: 500; color: var(--muted); font-size: 1rem; }
    .registration-password { position: relative; }
    .registration-password input { min-height: 48px; padding-right: 74px; }
    .registration-password-toggle { position: absolute; inset: 2px 3px 2px auto; min-width: 62px; min-height: 44px; border: 0; border-radius: 8px; background: transparent; color: var(--brand-ink); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .registration-password-toggle:hover { background: var(--brand-soft); }
    .registration-password-toggle:focus-visible, .confirmation-actions .btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
    .confirmation-panel { display: grid; gap: 16px; min-width: 0; padding: 24px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--brand-soft); overflow-wrap: anywhere; }
    .confirmation-panel:focus { outline: 2px solid var(--brand); outline-offset: 3px; }
    .confirmation-panel h2 { font-size: 1.5rem; margin: 0; }
    .confirmation-panel p { margin: 0; }
    .confirmation-icon { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 16px; background: var(--card); color: var(--brand-ink); }
    .confirmation-icon svg { width: 28px; height: 28px; }
    .confirmation-actions { display: grid; gap: 10px; margin-top: 8px; }
    .confirmation-actions .btn { white-space: normal; text-align: center; }
    @media (max-width: 600px) { .confirmation-panel { padding: 18px; } }
    h2 { margin: 6px 0 0; font-size: 1.05rem; }
    .matches { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .matches li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; }
  `,
})
export class RegisterSchoolPage {
  protected readonly auth = inject(AuthService);
  private readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  protected readonly challenge = viewChild(AuthChallengeComponent);

  protected readonly provinces = PROVINCES;
  protected readonly grades = signal<Grade[]>([]);
  protected readonly busy = signal(false);
  protected readonly searching = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmationEmail = signal<string | null>(null);
  protected readonly savedSchool = signal<School | null>(null);
  protected readonly workspaceUnavailable = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly searchTerm = signal('');
  protected readonly matches = signal<School[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('confirmationPanel')
  protected set confirmationPanel(panel: ElementRef<HTMLElement> | undefined) {
    panel?.nativeElement.focus();
  }

  @ViewChild('savedPanel')
  protected set savedPanel(panel: ElementRef<HTMLElement> | undefined) {
    panel?.nativeElement.focus();
  }

  protected readonly accountForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^(\+27|0)\d{9}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly schoolForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    town: ['', Validators.required],
    province: ['' as Province | '', Validators.required],
    lowestGrade: ['GR'],
    highestGrade: ['G7'],
    phone: [''],
    email: ['', Validators.email],
  });

  constructor() {
    void this.directory.grades().then((g) => this.grades.set(g));
  }

  protected onSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm.set(term);
    this.schoolForm.patchValue({ name: term });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(async () => {
      this.searching.set(true);
      try {
        this.matches.set(await this.staff.searchUnclaimedSchools(term));
      } finally {
        this.searching.set(false);
      }
    }, 300);
  }

  protected async claim(school: School): Promise<void> {
    if (!this.auth.isSignedIn() || this.busy() || this.savedSchool()) return;
    await this.run(() => this.staff.claimSchool(school.id));
  }

  protected async register(): Promise<void> {
    if (!this.auth.isSignedIn() || this.schoolForm.invalid || this.busy() || this.savedSchool()) return;
    const v = this.schoolForm.getRawValue();
    await this.run(() => this.staff.createSchool({
      name: v.name,
      town: v.town,
      province: v.province as Province,
      phone: v.phone || null,
      email: v.email || null,
      lowestGrade: v.lowestGrade,
      highestGrade: v.highestGrade,
    }));
  }

  protected async createAccount(): Promise<void> {
    if (this.auth.isSignedIn() || this.confirmationEmail() || this.accountForm.invalid || this.busy()) return;
    const challenge = this.challenge();
    const captchaToken = challenge?.takeToken();
    if (!captchaToken) { this.error.set('Please complete the security check.'); return; }
    this.busy.set(true);
    this.error.set(null);
    const a = this.accountForm.getRawValue();
    try {
      const { error, needsEmailConfirmation } = await this.auth.signUp({
        email: a.email.trim(),
        password: a.password,
        fullName: a.fullName.trim(),
        phone: a.phone.trim(),
        emailRedirectTo: window.location.origin + '/register-school',
        captchaToken,
      });
      if (error) throw error;
      this.accountForm.controls.password.reset();
      this.passwordVisible.set(false);
      if (needsEmailConfirmation) {
        this.confirmationEmail.set(a.email.trim());
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not create your login. Please try again.');
    } finally {
      challenge?.reset();
      this.busy.set(false);
    }
  }

  protected editAccount(): void {
    this.confirmationEmail.set(null);
    this.passwordVisible.set(false);
    this.accountForm.controls.password.reset();
    this.error.set(null);
  }

  protected schoolUrl(): string {
    return '/school?school=' + encodeURIComponent(this.savedSchool()!.id);
  }

  private async run(action: () => Promise<School>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.savedSchool.set(await action());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
      this.busy.set(false);
      return;
    }

    // Saving and opening the workspace are separate outcomes. A missing lazy chunk (for
    // example, after a deployment) or membership refresh failure must never replay the write.
    try {
      this.workspaceUnavailable.set(!await this.router.navigateByUrl(this.schoolUrl()));
    } catch {
      this.workspaceUnavailable.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
