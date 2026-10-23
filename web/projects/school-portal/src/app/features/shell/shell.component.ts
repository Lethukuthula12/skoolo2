import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService, StaffService } from '@skoolo/shared';

interface NavItem { label: string; link: string; icon: string; }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="brand">Skoolo</div>
        <div class="page-title">{{ pageTitle() }}</div>
        <span class="spacer"></span>
        <div class="profile">
          <div class="who">
            <div class="name">{{ fullName() }}</div>
            <div class="role">{{ staff.isAdmin() ? 'Administrator' : 'Teacher' }}</div>
          </div>
          <div class="avatar">{{ initials() }}</div>
          <button class="signout" type="button" (click)="signOut()">Sign out</button>
        </div>
      </header>

      <div class="body">
        <aside class="sidebar">
          <div class="school">{{ staff.currentSchool()?.name }}</div>
          <nav>
            @for (item of nav(); track item.link) {
              <a [routerLink]="item.link" routerLinkActive="active">
                <span class="ico" [innerHTML]="icon(item.icon)"></span>
                <span class="lbl">{{ item.label }}</span>
              </a>
            }
          </nav>
        </aside>

        <main class="content">
          @if (staff.currentSchool(); as school) {
            @if (!school.is_verified) {
              <div class="banner">
                <strong>Waiting for Skoolo to verify {{ school.name }}.</strong>
                Parents can see your listing but cannot apply until it is verified. You can set up everything in the meantime.
              </div>
            }
          }
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .shell { display: flex; flex-direction: column; min-height: 100vh; }

    /* Full-width brand header */
    .topbar {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; gap: 16px; height: 64px; padding: 0 24px;
      background: var(--brand); color: #fff;
    }
    .topbar .brand { font-weight: 800; font-size: 1.35rem; color: #fff; letter-spacing: -0.02em; width: 200px; }
    .topbar .page-title { font-size: 1.1rem; font-weight: 600; color: #fff; }
    .topbar .spacer { flex: 1; }
    .profile { display: flex; align-items: center; gap: 12px; }
    .who { text-align: right; line-height: 1.2; }
    .who .name { font-weight: 600; font-size: 0.9rem; color: #fff; }
    .who .role { font-size: 0.75rem; color: rgba(255, 255, 255, 0.7); }
    .avatar { width: 40px; height: 40px; border-radius: 50%; flex: none;
      background: rgba(255, 255, 255, 0.2); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 0.9rem; }
    .signout {
      border: 1px solid rgba(255, 255, 255, 0.35); background: rgba(255, 255, 255, 0.12); color: #fff;
      font: inherit; font-weight: 600; font-size: 0.85rem; padding: 7px 14px; border-radius: var(--radius-sm); cursor: pointer;
      transition: background 120ms ease;
      &:hover { background: rgba(255, 255, 255, 0.24); }
    }

    /* Dark sidebar + content */
    .body { display: grid; grid-template-columns: 248px minmax(0, 1fr); flex: 1; min-height: 0; }
    .sidebar {
      background: #22223d; padding: 16px 14px; position: sticky; top: 64px; height: calc(100vh - 64px); overflow-y: auto;
      display: flex; flex-direction: column; gap: 4px;
    }
    .school { color: rgba(255, 255, 255, 0.5); font-size: 0.8rem; padding: 4px 10px 12px; }
    nav { display: grid; gap: 4px; }
    nav a {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 14px; border-radius: 12px; color: rgba(255, 255, 255, 0.66); text-decoration: none;
      font-weight: 500; font-size: 0.94rem; transition: background 120ms ease, color 120ms ease;
    }
    nav a .ico { width: 20px; height: 20px; flex: none; display: grid; place-items: center; }
    nav a .ico ::ng-deep svg { width: 20px; height: 20px; display: block; }
    nav a:hover { background: rgba(255, 255, 255, 0.07); color: #fff; }
    nav a.active { background: var(--brand); color: #fff; font-weight: 600; box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25); }

    .content { padding: 24px; max-width: 1200px; width: 100%; min-width: 0; }
    .banner { background: var(--warning-soft); color: var(--warning); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.95rem; }

    @media (max-width: 900px) {
      .topbar { padding: 0 16px; gap: 12px; }
      .topbar .brand { width: auto; }
      .topbar .page-title { display: none; }
      .who { display: none; }

      .body { grid-template-columns: minmax(0, 1fr); }
      .sidebar { position: static; height: auto; flex-direction: column; padding: 10px 10px 6px; gap: 8px; }
      .school { display: none; }
      nav { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
      nav a { flex: 0 0 auto; flex-direction: column; gap: 4px; align-items: center; padding: 8px 12px; white-space: nowrap; }
      nav a .lbl { font-size: 0.66rem; }
      nav a.active { box-shadow: none; }
      .content { padding: 16px; }
    }
  `,
})
export class ShellComponent {
  protected readonly staff = inject(StaffService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly adminNav: NavItem[] = [
    { label: 'Dashboard', link: '/dashboard', icon: 'home' },
    { label: 'Applications', link: '/applications', icon: 'inbox' },
    { label: 'Enrolment settings', link: '/enrolment', icon: 'sliders' },
    { label: 'Classes & subjects', link: '/classes', icon: 'book' },
    { label: 'Learners', link: '/learners', icon: 'users' },
    { label: 'Reports', link: '/reports', icon: 'clipboard' },
    { label: 'Assessments', link: '/assessments', icon: 'check' },
    { label: 'Messages', link: '/messages', icon: 'message' },
    { label: 'Absences', link: '/absences', icon: 'userx' },
    { label: 'Fees', link: '/fees', icon: 'card' },
    { label: 'Timetable', link: '/timetable', icon: 'grid' },
    { label: 'Calendar', link: '/calendar', icon: 'calendar' },
    { label: 'Staff register', link: '/staff', icon: 'briefcase' },
    { label: 'School profile', link: '/school', icon: 'building' },
  ];
  private readonly teacherNav: NavItem[] = [
    { label: 'Home', link: '/home', icon: 'home' },
    { label: 'Reports', link: '/reports', icon: 'clipboard' },
    { label: 'Assessments', link: '/assessments', icon: 'check' },
    { label: 'Messages', link: '/messages', icon: 'message' },
    { label: 'Absences', link: '/absences', icon: 'userx' },
    { label: 'Timetable', link: '/timetable', icon: 'grid' },
    { label: 'Calendar', link: '/calendar', icon: 'calendar' },
  ];

  protected readonly nav = computed(() => (this.staff.isAdmin() ? this.adminNav : this.teacherNav));

  // The current URL, to show the page name in the header.
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly pageTitle = computed(() => {
    const path = (this.url() ?? '').split('?')[0];
    const match = [...this.adminNav, ...this.teacherNav].find((i) => path === i.link || path.startsWith(i.link + '/'));
    return match?.label ?? '';
  });

  protected readonly fullName = computed(() => this.auth.user()?.user_metadata?.['full_name'] || this.auth.user()?.email || '');
  protected readonly initials = computed(() => {
    const name = this.fullName();
    const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || (name[0] ?? 'U').toUpperCase();
  });

  // Inline line icons (Feather, MIT). currentColor so they follow the nav item's text colour.
  private readonly svg = (inner: string): string =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  private readonly icons: Record<string, string> = {
    home: this.svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
    inbox: this.svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    sliders: this.svg('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
    book: this.svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    users: this.svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    clipboard: this.svg('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>'),
    check: this.svg('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    message: this.svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    userx: this.svg('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>'),
    card: this.svg('<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
    grid: this.svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    calendar: this.svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    briefcase: this.svg('<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    building: this.svg('<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><line x1="9" y1="9" x2="9" y2="9.01"/><line x1="9" y1="13" x2="9" y2="13.01"/>'),
  };

  protected icon(name: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.icons[name] ?? '');
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.staff.reset();
    await this.router.navigateByUrl('/sign-in');
  }
}
