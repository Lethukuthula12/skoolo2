import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ASSESSMENT_KIND_LABELS, CalendarItemRow, FeeAccountRow, StaffApplication, StaffService,
} from '@skoolo/shared';

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, RouterLink],
  template: `
    <div class="stack">
      <div>
        <h1>Dashboard</h1>
        <p class="muted">{{ staff.currentSchool()?.name }} at a glance.</p>
      </div>

      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else {
        <div class="stats">
          <a class="stat" routerLink="/learners">
            <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
            <span class="body"><span class="value">{{ learnerCount() }}</span><span class="label">Learners</span></span>
          </a>
          <a class="stat" routerLink="/staff">
            <span class="icon accent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></span>
            <span class="body"><span class="value">{{ staffCount() }}</span><span class="label">Staff</span></span>
          </a>
          <a class="stat" routerLink="/applications">
            <span class="icon success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span>
            <span class="body"><span class="value">{{ applicationsTotal() }}</span><span class="label">Applications</span></span>
          </a>
          <a class="stat" routerLink="/fees">
            <span class="icon warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></span>
            <span class="body"><span class="value">{{ money(arrearsTotal()) }}</span><span class="label">Owed in fees</span></span>
          </a>
        </div>

        <div class="grid-2">
          <div class="card stack">
            <div class="toolbar"><h2>Recent applications</h2><span class="spacer"></span><a class="btn btn-ghost btn-sm" routerLink="/applications">See all</a></div>
            @if (recentApplications().length === 0) {
              <div class="empty">No applications yet.</div>
            } @else {
              <ul class="rows">
                @for (a of recentApplications(); track a.id) {
                  <li>
                    <div class="who">
                      <strong>{{ a.learner.first_name }} {{ a.learner.last_name }}</strong>
                      <span class="muted small">{{ a.period_grade.grades?.label }} · {{ a.submitted_at | date: 'd MMM' }}</span>
                    </div>
                    <span class="badge" [class]="statusBadge(a.status)">{{ statusLabel(a.status) }}</span>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="card stack">
            <div class="toolbar"><h2>In arrears</h2><span class="spacer"></span><a class="btn btn-ghost btn-sm" routerLink="/fees">See all</a></div>
            @if (arrears().length === 0) {
              <div class="empty">No outstanding fees.</div>
            } @else {
              <ul class="rows">
                @for (f of arrears(); track f.account_id) {
                  <li>
                    <div class="who">
                      <strong>{{ f.learner?.last_name }}, {{ f.learner?.first_name }}</strong>
                      <span class="muted small">Ref {{ f.payment_reference }}</span>
                    </div>
                    <strong class="owing">{{ money(f.balance) }}</strong>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="card stack">
            <div class="toolbar"><h2>Upcoming on the calendar</h2><span class="spacer"></span><a class="btn btn-ghost btn-sm" routerLink="/calendar">Open</a></div>
            @if (upcoming().length === 0) {
              <div class="empty">Nothing scheduled yet.</div>
            } @else {
              <ul class="rows">
                @for (c of upcoming(); track c.id) {
                  <li>
                    <div class="who">
                      <strong>{{ c.title }}</strong>
                      <span class="muted small">{{ c.event_date | date: 'EEE d MMM' }}@if (c.classes) { · {{ c.classes.name }} }</span>
                    </div>
                    <span class="badge badge-accent">{{ kindLabels[c.kind] }}</span>
                  </li>
                }
              </ul>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .stat { text-decoration: none; }
    .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .rows li { display: flex; align-items: center; gap: 12px; padding: 10px 2px; border-top: 1px solid var(--line); }
    .rows li:first-child { border-top: none; }
    .who { flex: 1; min-width: 0; display: grid; gap: 1px; }
    .who strong { color: var(--title); font-size: 0.92rem; }
    .owing { color: var(--danger); white-space: nowrap; }
  `,
})
export class DashboardPage {
  protected readonly staff = inject(StaffService);

  protected readonly kindLabels = ASSESSMENT_KIND_LABELS;
  private readonly year = new Date().getFullYear() + 1;
  protected readonly loading = signal(true);

  private readonly applications = signal<StaffApplication[]>([]);
  private readonly fees = signal<FeeAccountRow[]>([]);
  private readonly calendar = signal<CalendarItemRow[]>([]);
  protected readonly learnerCount = signal(0);
  protected readonly staffCount = signal(0);

  protected readonly applicationsTotal = computed(() => this.applications().length);
  protected readonly recentApplications = computed(() => this.applications().slice(0, 5));
  protected readonly arrearsTotal = computed(() => this.fees().reduce((sum, f) => sum + Math.max(0, Number(f.balance)), 0));
  protected readonly arrears = computed(() =>
    this.fees().filter((f) => Number(f.balance) > 0).sort((a, b) => Number(b.balance) - Number(a.balance)).slice(0, 5),
  );
  protected readonly upcoming = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.calendar().filter((c) => c.event_date >= today).slice(0, 5);
  });

  constructor() {
    void this.load();
  }

  protected money(v: number | string | null): string {
    return `R ${Number(v ?? 0).toFixed(2)}`;
  }

  protected statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }
  protected statusBadge(status: string): string {
    if (status === 'accepted') return 'badge-success';
    if (status === 'declined' || status === 'withdrawn') return 'badge-danger';
    if (status === 'waitlisted' || status === 'more_info_needed') return 'badge-warning';
    return 'badge';
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [apps, learners, members, fees, calendar] = await Promise.all([
        this.staff.applications(),
        this.staff.schoolLearners(),
        this.staff.staffMembers(),
        this.staff.feeAccounts(this.year),
        this.staff.calendarItems(),
      ]);
      this.applications.set(apps);
      this.learnerCount.set(learners.length);
      this.staffCount.set(members.filter((m) => m.is_active).length);
      this.fees.set(fees);
      this.calendar.set([...calendar].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }
}
