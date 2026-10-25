import { Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService, StaffService, StaffSessionTimeoutService, StaffSessionWarningComponent, ThemeService } from '@skoolo/shared';
import { ThemeCustomizerComponent } from './theme-customizer.component';
import { PortalDrawerComponent } from '../../ui/portal-drawer.component';
import { PortalNavigationComponent } from './portal-navigation.component';

interface NavItem { label: string; link: string; icon: string; }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, PortalNavigationComponent, ThemeCustomizerComponent, PortalDrawerComponent, StaffSessionWarningComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly staff = inject(StaffService);
  protected readonly auth = inject(AuthService);
  // Instantiates the idle/absolute staff session clock; only the shell (staff-only) renders its warning.
  private readonly sessionTimeout = inject(StaffSessionTimeoutService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly theme = inject(ThemeService);
  private readonly profileMenu = viewChild<ElementRef<HTMLDetailsElement>>('profileMenu');
  protected readonly mobileOpen = signal(false);
  protected readonly compact = signal(false);
  private readonly sections = [
    { label: 'Overview', links: ['/dashboard', '/home'] },
    { label: 'Enrolment', links: ['/applications', '/enrolment'] },
    { label: 'Academics', links: ['/learners', '/classes', '/attendance', '/reports', '/assessments', '/documents', '/timetable'] },
    { label: 'Communication', links: ['/messages', '/notices', '/absences', '/calendar'] },
    { label: 'Finance', links: ['/fees'] },
    { label: 'Administration', links: ['/staff', '/school'] },
  ];
  protected readonly groups = computed(() => this.sections.map(section => ({
    label: section.label, items: section.links.flatMap(link => this.nav().filter(item => item.link === link).map(item => ({ ...item, icon: this.icon(item.icon) }))),
  })).filter(group => group.items.length > 0));
  protected readonly activeGroup = computed(() => this.groups().find(group =>
    group.items.some(item => this.url().split('?')[0] === item.link || this.url().startsWith(item.link + '/')))?.label ?? 'School portal');
  @HostListener('document:click', ['$event'])
  protected closeProfileOutside(event: MouseEvent): void {
    const menu = this.profileMenu()?.nativeElement;
    if (menu && !menu.contains(event.target as Node)) menu.open = false;
  }
  @HostListener('window:resize')
  protected closeMobileOnDesktop(): void { if (window.innerWidth > 900) this.mobileOpen.set(false); }

  constructor() {
    // Apply the signed-in school's saved theme (and re-apply whenever the school changes).
    effect(() => this.theme.applyFromSchool(this.staff.currentSchool()));
    effect(() => { this.url(); this.mobileOpen.set(false); });
  }

  private readonly adminNav: NavItem[] = [
    { label: 'Forms & Documents', link: '/documents', icon: 'clipboard' },
    { label: 'Dashboard', link: '/dashboard', icon: 'home' },
    { label: 'Applications', link: '/applications', icon: 'inbox' },
    { label: 'Enrolment settings', link: '/enrolment', icon: 'sliders' },
    { label: 'Classes & subjects', link: '/classes', icon: 'book' },
    { label: 'Learners', link: '/learners', icon: 'users' },
    { label: 'Reports', link: '/reports', icon: 'clipboard' },
    { label: 'Assessments', link: '/assessments', icon: 'check' },
    { label: 'Messages', link: '/messages', icon: 'message' },
    { label: 'Notices', link: '/notices', icon: 'bell' },
    { label: 'Absences', link: '/absences', icon: 'userx' },
    { label: 'Attendance', link: '/attendance', icon: 'usercheck' },
    { label: 'Fees', link: '/fees', icon: 'card' },
    { label: 'Timetable', link: '/timetable', icon: 'grid' },
    { label: 'Calendar', link: '/calendar', icon: 'calendar' },
    { label: 'Staff register', link: '/staff', icon: 'briefcase' },
    { label: 'School profile', link: '/school', icon: 'building' },
  ];
  private readonly teacherNav: NavItem[] = [
    { label: 'Forms & Documents', link: '/documents', icon: 'clipboard' },
    { label: 'Home', link: '/home', icon: 'home' },
    { label: 'Reports', link: '/reports', icon: 'clipboard' },
    { label: 'Assessments', link: '/assessments', icon: 'check' },
    { label: 'Messages', link: '/messages', icon: 'message' },
    { label: 'Notices', link: '/notices', icon: 'bell' },
    { label: 'Absences', link: '/absences', icon: 'userx' },
    { label: 'Attendance', link: '/attendance', icon: 'usercheck' },
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
    usercheck: this.svg('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>'),
    bell: this.svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
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
