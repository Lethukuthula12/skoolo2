import { Component, computed, input } from '@angular/core';

export interface ApplicationOverview { label: string; count: number; color: string; }

@Component({
  selector: 'app-school-overview',
  template: `
    <div class="overview-grid">
      <section class="card">
        <div class="chart-heading"><div><h2>Application overview</h2><p>Where applications stand</p></div><span class="total">{{ total() }} <small>total</small></span></div>
        @if (total()) {
          <ul class="bars" aria-label="Applications by status">
            @for (item of applications(); track item.label) {
              <li><div class="bar-label"><span>{{ item.label }}</span><strong>{{ item.count }}</strong></div><div class="track" aria-hidden="true"><span [style.width.%]="item.count / total() * 100" [style.background]="item.color"></span></div></li>
            }
          </ul>
        } @else { <div class="empty">Your application overview will appear when parents start applying.</div> }
      </section>
      <section class="card">
        <div class="chart-heading"><div><h2>Fee overview</h2><p>School accounts · {{ year() }}</p></div></div>
        @if (due() > 0) {
          <div class="fee-chart">
            <div class="ring" role="img" [attr.aria-label]="percentage() + '% of total fees paid'">
              <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="50" /><circle class="ring-value" cx="60" cy="60" r="50" pathLength="100" [attr.stroke-dasharray]="percentage() + ' 100'" /></svg>
              <div><strong>{{ percentage() }}<small>%</small></strong><span>Paid to date</span></div>
            </div>
            <dl><div><dt><i class="paid-dot"></i>Paid to date</dt><dd>{{ money(paid()) }}</dd></div><div><dt><i></i>Total fees charged</dt><dd>{{ money(due()) }}</dd></div></dl>
          </div>
        } @else { <div class="empty">Your fee overview will appear once learner accounts have fees assigned.</div> }
      </section>
    </div>
  `,
  styleUrl: './school-overview.component.scss',
})
export class SchoolOverviewComponent {
  readonly applications = input.required<ApplicationOverview[]>();
  readonly due = input.required<number>();
  readonly paid = input.required<number>();
  readonly year = input.required<number>();
  protected readonly total = computed(() => this.applications().reduce((sum, row) => sum + row.count, 0));
  protected readonly percentage = computed(() => this.due() > 0 ? Math.min(100, Math.max(0, Math.round(this.paid() / this.due() * 100))) : 0);
  private readonly currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });
  protected money(value: number): string { return this.currency.format(value); }
}
