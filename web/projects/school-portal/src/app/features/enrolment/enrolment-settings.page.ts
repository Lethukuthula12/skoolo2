import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionFeedbackComponent, EnrolmentPeriod, Grade, GradeAvailabilityRow, SchoolDirectoryService, StaffService } from '@skoolo/shared';

interface GradeRow {
  code: string;
  label: string;
  offered: boolean;
  isOpen: boolean;
  capacity: number | null;
  placesTaken: number;
  existingId: string | null;
}

@Component({
  selector: 'app-enrolment-settings-page',
  imports: [ActionFeedbackComponent, CurrencyPipe, DatePipe, FormsModule],
  template: `
    <skoolo-action-feedback [success]="notice()" [error]="error()" [pending]="busy()" />
    <div class="stack">
      <div class="toolbar">
        <div>
          <h1>Enrolment settings</h1>
          <p class="muted">Open an enrolment period, set the fee, and decide which grades take applications and how many.</p>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-outline" type="button" (click)="newPeriod()" [disabled]="busy()">New period</button>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      @if (loading()) {
        <div class="loading-state" role="status"><span class="sr-only">Loading school information…</span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span></div>
      } @else if (periods().length === 0) {
        <div class="card empty">No enrolment period yet. Create one to start accepting applications.</div>
      } @else {
        <div class="periods">
          @for (p of periods(); track p.id) {
            <button class="period" type="button" [class.active]="p.id === selectedId()" (click)="select(p.id)">
              <div class="row">
                <strong>{{ p.name }}</strong>
                <span class="badge" [class.badge-success]="p.status === 'open'" [class.badge-muted]="p.status !== 'open'">{{ p.status }}</span>
              </div>
              <div class="muted small">{{ p.academic_year }} · fee {{ p.fee_amount | currency: p.currency : 'R ' : '1.2-2' }}
                @if (p.closes_at) { · closes {{ p.closes_at | date: 'd MMM yyyy' }} }</div>
            </button>
          }
        </div>

        @if (selected(); as p) {
          @let f = form();
          <form class="card stack" (ngSubmit)="savePeriod()">
            <h2>{{ p.name }}</h2>
            <div class="form-grid">
              <div class="field"><label for="pname">Name</label><input id="pname" type="text" [(ngModel)]="f.name" name="name" required /></div>
              <div class="field"><label for="pyear">Academic year</label><input id="pyear" type="number" [(ngModel)]="f.academic_year" name="year" min="2020" max="2100" required /></div>
              <div class="field">
                <label for="pstatus">Status</label>
                <select id="pstatus" [(ngModel)]="f.status" name="status">
                  <option value="draft">Draft (hidden from parents)</option>
                  <option value="open">Open for applications</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div class="field"><label for="pfee">Enrolment fee (ZAR)</label><input id="pfee" type="number" step="0.01" min="0" [(ngModel)]="f.fee_amount" name="fee" /></div>
              <div class="field"><label for="popens">Opens</label><input id="popens" type="date" [(ngModel)]="f.opens_at" name="opens" /></div>
              <div class="field"><label for="pcloses">Closes</label><input id="pcloses" type="date" [(ngModel)]="f.closes_at" name="closes" /></div>
              <div class="field wide"><label for="pinstr">Payment instructions shown to parents</label><textarea id="pinstr" [(ngModel)]="f.instructions" name="instructions"></textarea></div>
            </div>
            <div class="row">
              <button class="btn btn-primary" type="submit" [disabled]="busy()">Save period</button>
              @if (f.status === 'open') { <span class="muted small">Only one period can be open at a time.</span> }
            </div>
          </form>

          <div class="card stack">
            <div class="toolbar">
              <h2>Grades for {{ p.name }}</h2>
              <span class="spacer"></span>
              <button class="btn btn-primary" type="button" (click)="saveGrades()" [disabled]="busy()">Save grades</button>
            </div>
            <p class="muted small">
              Tick the grades you are taking applications for. Leave capacity blank for no limit. A grade
              shows as full to parents once places taken reaches capacity. Places are held from submission and
              released when an application is declined or withdrawn.
            </p>
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Offered</th><th>Grade</th><th>Open</th><th>Capacity</th><th>Places taken</th><th>Places left</th></tr></thead>
                <tbody>
                  @for (g of gradeRows(); track g.code) {
                    <tr>
                      <td><input type="checkbox" [(ngModel)]="g.offered" [name]="'offered-' + g.code" /></td>
                      <td><strong>{{ g.label }}</strong></td>
                      <td><input type="checkbox" [(ngModel)]="g.isOpen" [name]="'open-' + g.code" [disabled]="!g.offered" /></td>
                      <td><input type="number" min="0" class="capacity" [(ngModel)]="g.capacity" [name]="'cap-' + g.code" [disabled]="!g.offered" placeholder="No limit" /></td>
                      <td>{{ g.offered ? g.placesTaken : '' }}</td>
                      <td>
                        @if (g.offered) {
                          @if (g.capacity === null || g.capacity === undefined) { <span class="muted">No limit</span> }
                          @else if (g.capacity - g.placesTaken <= 0) { <span class="badge badge-danger">Full</span> }
                          @else { {{ g.capacity - g.placesTaken }} }
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .periods { display: flex; gap: 10px; flex-wrap: wrap; }
    .period { background: var(--card); border: 2px solid var(--line); border-radius: var(--radius); padding: 12px 14px; text-align: left; font: inherit; cursor: pointer; min-width: 220px; display: grid; gap: 4px; }
    .period.active { border-color: var(--brand); }
    .period .row { justify-content: space-between; }
    .capacity { width: 110px; }
    input[type='checkbox'] { width: 18px; height: 18px; }
  `,
})
export class EnrolmentSettingsPage {
  private readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);

  protected readonly periods = signal<EnrolmentPeriod[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.periods().find((p) => p.id === this.selectedId()) ?? null);
  protected readonly gradeRows = signal<GradeRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly form = signal<{
    name: string; academic_year: number; status: 'draft' | 'open' | 'closed'; fee_amount: number;
    opens_at: string; closes_at: string; instructions: string;
  }>({ name: '', academic_year: new Date().getFullYear() + 1, status: 'draft', fee_amount: 0, opens_at: '', closes_at: '', instructions: '' });

  private grades: Grade[] = [];

  constructor() {
    void this.load();
  }

  protected async select(id: string): Promise<void> {
    this.selectedId.set(id);
    const p = this.selected();
    if (!p) return;
    this.form.set({
      name: p.name,
      academic_year: p.academic_year,
      status: p.status,
      fee_amount: Number(p.fee_amount),
      opens_at: p.opens_at ?? '',
      closes_at: p.closes_at ?? '',
      instructions: p.instructions ?? '',
    });
    await this.loadGrades(p.id);
  }

  protected async newPeriod(): Promise<void> {
    const latestYear = Math.max(new Date().getFullYear(), ...this.periods().map((p) => p.academic_year));
    const year = latestYear + 1;
    await this.run(async () => {
      const created = await this.staff.createPeriod({
        academic_year: year,
        name: `${year} Enrolment`,
        status: 'draft',
        fee_amount: 0,
        currency: 'ZAR',
      });
      this.periods.update((list) => [created, ...list]);
      await this.select(created.id);
      this.notice.set(`Created ${created.name} as a draft. Set the fee and grades, then open it.`);
    });
  }

  protected async savePeriod(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    await this.run(async () => {
      const updated = await this.staff.updatePeriod(id, {
        name: this.form().name.trim(),
        academic_year: Number(this.form().academic_year),
        status: this.form().status,
        fee_amount: Number(this.form().fee_amount) || 0,
        opens_at: this.form().opens_at || null,
        closes_at: this.form().closes_at || null,
        instructions: this.form().instructions.trim() || null,
      });
      this.periods.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
      this.notice.set(updated.status === 'open' ? 'Saved. Parents can now apply.' : 'Saved.');
    }, 'Could not save. If you are opening this period, close the other open period first.');
  }

  protected async saveGrades(): Promise<void> {
    const periodId = this.selectedId();
    if (!periodId) return;
    await this.run(async () => {
      for (const row of this.gradeRows()) {
        if (row.offered) {
          const capacity = row.capacity === null || row.capacity === undefined || (row.capacity as unknown) === '' ? null : Number(row.capacity);
          await this.staff.upsertPeriodGrade({ period_id: periodId, grade_code: row.code, is_open: row.isOpen, capacity });
        } else if (row.existingId) {
          await this.staff.removePeriodGrade(row.existingId);
        }
      }
      await this.loadGrades(periodId);
      this.notice.set('Grades saved.');
    }, 'Could not save grades. A grade with applications cannot be removed; close it instead.');
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      [this.grades] = await Promise.all([this.directory.grades()]);
      const periods = await this.staff.periods();
      this.periods.set(periods);
      const open = periods.find((p) => p.status === 'open') ?? periods[0];
      if (open) await this.select(open.id);
    } catch (err) {
      console.error(err);
      this.error.set('Could not load enrolment settings.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadGrades(periodId: string): Promise<void> {
    const availability: GradeAvailabilityRow[] = await this.staff.gradeAvailability(periodId);
    const school = this.staff.currentSchool();
    const lowest = this.grades.find((g) => g.code === school?.lowest_grade)?.sort_order ?? 0;
    const highest = this.grades.find((g) => g.code === school?.highest_grade)?.sort_order ?? 99;
    this.gradeRows.set(
      this.grades
        .filter((g) => g.sort_order >= lowest && g.sort_order <= highest)
        .map((g) => {
          const row = availability.find((a) => a.grade_code === g.code);
          return {
            code: g.code,
            label: g.label,
            offered: !!row,
            isOpen: row?.is_open ?? true,
            capacity: row?.capacity ?? null,
            placesTaken: row?.places_taken ?? 0,
            existingId: row?.id ?? null,
          };
        }),
    );
  }

  private async run(action: () => Promise<void>, failure = 'Something went wrong.'): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (err) {
      console.error(err);
      this.error.set(failure);
    } finally {
      this.busy.set(false);
    }
  }
}
