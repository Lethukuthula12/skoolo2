import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  APPLICATION_STATUS_LABELS, ApplicationStatus, PAYMENT_STATUS_LABELS, PaymentStatus, StaffApplication, StaffService,
} from '@skoolo/shared';
import { paymentBadgeClass, statusBadgeClass } from './badges';
import { TablePagination } from '../../ui/table-pagination';
import { TablePaginationComponent } from '../../ui/table-pagination.component';

type QuickFilter = 'all' | 'to_review' | 'to_confirm' | 'accepted' | 'waitlisted';

@Component({
  selector: 'app-applications-list-page',
  imports: [DatePipe, FormsModule, TablePaginationComponent],
  template: `
    <div class="stack">
      <div>
        <h1>Applications</h1>
        <p class="muted">Everything parents have submitted to {{ staff.currentSchool()?.name }}.</p>
      </div>

      <div class="stats">
        <button class="stat" [class.active]="quick() === 'all'" (click)="quick.set('all')">
          <div class="label">All</div><div class="value">{{ applications().length }}</div>
        </button>
        <button class="stat" [class.active]="quick() === 'to_review'" (click)="quick.set('to_review')">
          <div class="label">To review</div><div class="value">{{ count('to_review') }}</div>
        </button>
        <button class="stat" [class.active]="quick() === 'to_confirm'" (click)="quick.set('to_confirm')">
          <div class="label">Payments to confirm</div><div class="value">{{ count('to_confirm') }}</div>
        </button>
        <button class="stat" [class.active]="quick() === 'accepted'" (click)="quick.set('accepted')">
          <div class="label">Accepted</div><div class="value">{{ count('accepted') }}</div>
        </button>
        <button class="stat" [class.active]="quick() === 'waitlisted'" (click)="quick.set('waitlisted')">
          <div class="label">Waitlisted</div><div class="value">{{ count('waitlisted') }}</div>
        </button>
      </div>

      <div class="card stack">
        <div class="toolbar"><div><h2>Application register</h2><p>Review learners, documents and payment status.</p></div><span class="spacer"></span><button class="btn btn-outline" type="button" (click)="load()" [disabled]="loading()">Refresh</button></div>
        <div class="table-tools">
          <label class="search-field">Search applications<input type="search" placeholder="Learner, parent or reference" [ngModel]="search()" (ngModelChange)="search.set($event)" /></label>
          <label>Status<select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
            <option value="">Any status</option>
            @for (s of statuses; track s) { <option [value]="s">{{ statusLabels[s] }}</option> }
          </select></label>
          <label>Payment<select [ngModel]="paymentFilter()" (ngModelChange)="paymentFilter.set($event)">
            <option value="">Any payment state</option>
            @for (p of payments; track p) { <option [value]="p">{{ paymentLabels[p] }}</option> }
          </select></label>
          <label>Sort by<select [ngModel]="sort()" (ngModelChange)="sort.set($event)"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Learner A–Z</option></select></label>
        </div>

        @if (loading()) {
          <div class="loading-state" role="status"><span class="sr-only">Loading school information…</span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span></div>
        } @else if (error()) {
          <p class="error">{{ error() }}</p>
        } @else if (filtered().length === 0) {
          <div class="empty"><p>{{ applications().length ? 'No applications match these filters.' : 'Applications will appear here when parents submit them.' }}</p>@if (applications().length) { <button class="btn btn-outline" type="button" (click)="clearFilters()">Clear filters</button> }</div>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Learner</th><th>Grade</th><th>Parent</th><th>Submitted</th><th>Status</th><th>Payment</th><th>Reference</th><th>Docs</th>
                </tr>
              </thead>
              <tbody>
                @for (app of pagination.visible(); track app.id) {
                  <tr>
                    <td><button class="table-link" type="button" (click)="open(app)">{{ app.learner.first_name }} {{ app.learner.last_name }}</button></td>
                    <td>{{ app.period_grade.grades?.label }}</td>
                    <td>{{ app.parent.full_name }}<br /><span class="muted small">{{ app.parent.phone }}</span></td>
                    <td>{{ app.submitted_at | date: 'd MMM yyyy' }}</td>
                    <td><span class="badge" [class]="'badge ' + statusClass(app.status)">{{ statusLabels[app.status] }}</span></td>
                    <td><span class="badge" [class]="'badge ' + paymentClass(app.payment_status)">{{ paymentLabels[app.payment_status] }}</span></td>
                    <td><code>{{ app.payment_reference }}</code></td>
                    <td>{{ app.application_documents.length }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (!loading() && !error()) { <app-table-pagination [pagination]="pagination" /> }
      </div>
    </div>
  `,
  styles: `
    .stat { text-align: left; font: inherit; }
    code { font-size: 0.85rem; }
  `,
})
export class ApplicationsListPage {
  protected readonly staff = inject(StaffService);
  private readonly router = inject(Router);

  protected readonly statusLabels = APPLICATION_STATUS_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;
  protected readonly statuses = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];
  protected readonly payments = Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[];
  protected readonly statusClass = statusBadgeClass;
  protected readonly paymentClass = paymentBadgeClass;

  protected readonly applications = signal<StaffApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<ApplicationStatus | ''>('');
  protected readonly paymentFilter = signal<PaymentStatus | ''>('');
  protected readonly quick = signal<QuickFilter>('all');
  protected readonly sort = signal('newest');

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const payment = this.paymentFilter();
    return this.applications().filter((app) => {
      if (!this.matchesQuick(app, this.quick())) return false;
      if (status && app.status !== status) return false;
      if (payment && app.payment_status !== payment) return false;
      if (!term) return true;
      const haystack = [
        app.learner.first_name, app.learner.last_name, app.parent.full_name, app.parent.phone, app.parent.email,
        app.payment_reference,
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  });

  protected readonly sorted = computed(() => [...this.filtered()].sort((a, b) => {
    if (this.sort() === 'name') return a.learner.last_name.localeCompare(b.learner.last_name) || a.learner.first_name.localeCompare(b.learner.first_name);
    const date = (a.submitted_at ?? '').localeCompare(b.submitted_at ?? '');
    return this.sort() === 'oldest' ? date : -date;
  }));
  protected readonly pagination = new TablePagination(this.sorted,
    computed(() => [this.search(), this.statusFilter(), this.paymentFilter(), this.quick(), this.sort()]));

  protected clearFilters(): void {
    this.search.set(''); this.statusFilter.set(''); this.paymentFilter.set(''); this.quick.set('all');
  }

  constructor() {
    void this.load();
  }

  protected count(filter: QuickFilter): number {
    return this.applications().filter((app) => this.matchesQuick(app, filter)).length;
  }

  protected open(app: StaffApplication): void {
    void this.router.navigate(['/applications', app.id]);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.applications.set(await this.staff.applications());
    } catch (err) {
      console.error(err);
      this.error.set('Could not load applications.');
    } finally {
      this.loading.set(false);
    }
  }

  private matchesQuick(app: StaffApplication, filter: QuickFilter): boolean {
    switch (filter) {
      case 'to_review': return app.status === 'submitted' || app.status === 'under_review' || app.status === 'more_info_needed';
      case 'to_confirm': return app.payment_status === 'marked_paid';
      case 'accepted': return app.status === 'accepted';
      case 'waitlisted': return app.status === 'waitlisted';
      default: return true;
    }
  }
}
