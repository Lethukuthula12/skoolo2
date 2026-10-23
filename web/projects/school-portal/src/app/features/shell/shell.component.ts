import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, StaffService } from '@skoolo/shared';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="top">
          <div class="brand">Skoolo</div>
          <div class="school">{{ staff.currentSchool()?.name }}</div>
        </div>
        <nav>
          @if (staff.isAdmin()) {
            <a routerLink="/applications" routerLinkActive="active">Applications</a>
            <a routerLink="/enrolment" routerLinkActive="active">Enrolment settings</a>
            <a routerLink="/classes" routerLinkActive="active">Classes & subjects</a>
            <a routerLink="/learners" routerLinkActive="active">Learners</a>
            <a routerLink="/reports" routerLinkActive="active">Reports</a>
            <a routerLink="/messages" routerLinkActive="active">Messages</a>
            <a routerLink="/absences" routerLinkActive="active">Absences</a>
            <a routerLink="/staff" routerLinkActive="active">Staff register</a>
            <a routerLink="/school" routerLinkActive="active">School profile</a>
          } @else {
            <a routerLink="/home" routerLinkActive="active">Home</a>
            <a routerLink="/reports" routerLinkActive="active">Reports</a>
            <a routerLink="/messages" routerLinkActive="active">Messages</a>
            <a routerLink="/absences" routerLinkActive="active">Absences</a>
          }
        </nav>
        <div class="user">
          <div class="name">{{ auth.user()?.user_metadata?.['full_name'] || auth.user()?.email }}</div>
          <button class="btn btn-ghost btn-sm" type="button" (click)="signOut()">Sign out</button>
        </div>
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
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
    .sidebar {
      background: #fff; border-right: 1px solid var(--line); padding: 20px 16px;
      display: flex; flex-direction: column; gap: 20px; position: sticky; top: 0; height: 100vh;
    }
    .brand { font-weight: 800; font-size: 1.35rem; color: var(--brand); }
    .school { font-size: 0.9rem; color: var(--muted); margin-top: 2px; }
    nav { display: grid; gap: 4px; }
    nav a {
      padding: 10px 12px; border-radius: 9px; color: var(--ink); text-decoration: none; font-weight: 500;
      &:hover { background: var(--bg); }
      &.active { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
    }
    .user { margin-top: auto; display: grid; gap: 6px; }
    .name { font-size: 0.9rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
    .content { padding: 24px; max-width: 1200px; width: 100%; min-width: 0; }
    .banner { background: var(--warning-soft); color: var(--warning); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.95rem; }

    @media (max-width: 900px) {
      .shell { grid-template-columns: minmax(0, 1fr); }
      .sidebar { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; padding: 12px 16px; gap: 12px; border-right: none; border-bottom: 1px solid var(--line); }
      .top { flex: 1 1 100%; display: flex; gap: 10px; align-items: baseline; }
      nav { display: flex; gap: 4px; flex: 1 1 auto; min-width: 0; overflow-x: auto; }
      nav a { white-space: nowrap; padding: 8px 10px; font-size: 0.9rem; }
      .user { margin: 0; grid-auto-flow: column; align-items: center; }
      .name { display: none; }
      .content { padding: 16px; }
    }
  `,
})
export class ShellComponent {
  protected readonly staff = inject(StaffService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.staff.reset();
    await this.router.navigateByUrl('/sign-in');
  }
}
