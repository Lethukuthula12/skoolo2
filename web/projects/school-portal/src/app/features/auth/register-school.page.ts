import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, Grade, PROVINCES, Province, School, SchoolDirectoryService, StaffService } from '@skoolo/shared';

/**
 * A principal or admin puts their school on Skoolo. Either they claim a school already in the
 * directory, or they register a new one. They become its first admin; Skoolo verifies it before
 * parents can apply.
 */
@Component({
  selector: 'app-register-school-page',
  imports: [ReactiveFormsModule, RouterLink],
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
          <form class="stack" [formGroup]="accountForm" (ngSubmit)="createAccount()">
            <h2>1. Your login</h2>
            <p class="small muted">Create and confirm your login first. You will add or claim your school next.</p>
            <div class="form-grid">
              <div class="field"><label for="fullName">Your full name</label><input id="fullName" type="text" formControlName="fullName" autocomplete="name" /></div>
              <div class="field"><label for="phone">Cellphone</label><input id="phone" type="tel" formControlName="phone" autocomplete="tel" /></div>
              <div class="field"><label for="email">Email</label><input id="email" type="email" formControlName="email" autocomplete="email" /></div>
              <div class="field"><label for="password">Choose a password</label><input id="password" type="password" formControlName="password" autocomplete="new-password" /></div>
            </div>
            @if (notice()) { <p class="auth-notice" role="status">{{ notice() }}</p> }
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn btn-primary" type="submit" [disabled]="accountForm.invalid || busy()">{{ busy() ? 'Creating your login…' : 'Create login and continue' }}</button>
            <p class="small muted">Already have a login? <a routerLink="/sign-in" [queryParams]="{ returnUrl: '/register-school' }">Sign in first</a>.</p>
          </form>
        } @else {
          <p class="small">Signed in as <strong>{{ auth.user()?.email }}</strong>.</p>
        }

        @if (auth.isSignedIn()) {
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
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: 100%; max-width: 640px; }
    .brand { font-weight: 800; font-size: 1.3rem; color: var(--brand); }
    .brand span { font-weight: 500; color: var(--muted); font-size: 1rem; }
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

  protected readonly provinces = PROVINCES;
  protected readonly grades = signal<Grade[]>([]);
  protected readonly busy = signal(false);
  protected readonly searching = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly matches = signal<School[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (!this.auth.isSignedIn() || this.busy()) return;
    await this.run(async () => {
      await this.staff.claimSchool(school.id);
    });
  }

  protected async register(): Promise<void> {
    if (!this.auth.isSignedIn() || this.schoolForm.invalid || this.busy()) return;
    const v = this.schoolForm.getRawValue();
    await this.run(async () => {
      await this.staff.createSchool({
        name: v.name,
        town: v.town,
        province: v.province as Province,
        phone: v.phone || null,
        email: v.email || null,
        lowestGrade: v.lowestGrade,
        highestGrade: v.highestGrade,
      });
    });
  }

  protected async createAccount(): Promise<void> {
    if (this.auth.isSignedIn() || this.accountForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    const a = this.accountForm.getRawValue();
    try {
      const { error, needsEmailConfirmation } = await this.auth.signUp({
        email: a.email.trim(),
        password: a.password,
        fullName: a.fullName.trim(),
        phone: a.phone.trim(),
        emailRedirectTo: window.location.origin + '/register-school',
      });
      if (error) throw error;
      this.accountForm.controls.password.reset();
      if (needsEmailConfirmation) {
        this.notice.set('Check your email for a confirmation link. It will bring you back here to add or claim your school.');
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not create your login. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      await this.router.navigateByUrl('/school');
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }
}
