import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ActionFeedbackComponent, Learner, MyClass, StaffService } from '@skoolo/shared';

type AttStatus = 'present' | 'absent' | 'late';
interface ClassOption { id: string; label: string; }

@Component({
  selector: 'app-attendance-page',
  imports: [ActionFeedbackComponent, FormsModule],
  template: `
    <skoolo-action-feedback [success]="notice()" [error]="error()" [pending]="busy()" />
    <div class="stack">
      <div class="toolbar">
        <div>
          <h1>Attendance</h1>
          <p class="muted">Take the daily register for your class. Everyone starts present — mark the exceptions.</p>
        </div>
      </div>

      <div class="card">
        <div class="row wrap">
          <label class="field">Class
            <select [ngModel]="selectedClassId()" (ngModelChange)="selectedClassId.set($event); loadRegister()" [ngModelOptions]="{standalone: true}">
              @for (c of classOptions(); track c.id) { <option [value]="c.id">{{ c.label }}</option> }
            </select>
          </label>
          <label class="field">Date
            <input type="date" [ngModel]="date()" (ngModelChange)="date.set($event); loadRegister()" [ngModelOptions]="{standalone: true}" [max]="todayIso" />
          </label>
        </div>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      @if (loading()) {
        <div class="loading-state" role="status"><span class="sr-only">Loading school information…</span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span></div>
      } @else if (!selectedClassId()) {
        <div class="empty">Choose a class to take the register.</div>
      } @else if (learners().length === 0) {
        <div class="empty">No learners in this class.</div>
      } @else {
        <div class="card stack">
          <div class="toolbar">
            <div class="counts">
              <span class="pill present">{{ count('present') }} present</span>
              <span class="pill absent">{{ count('absent') }} absent</span>
              <span class="pill late">{{ count('late') }} late</span>
            </div>
            <span class="spacer"></span>
            <button class="btn btn-ghost btn-sm" type="button" (click)="markAllPresent()">Mark all present</button>
            <button class="btn btn-outline btn-sm" type="button" (click)="exportRegister()">Export</button>
            <button class="btn btn-primary btn-sm" type="button" (click)="save()" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save register' }}</button>
          </div>
          @if (taken()) { <p class="muted small">Register taken for this day — you can still change it.</p> }

          <div class="roster">
            @for (l of learners(); track l.id) {
              <div class="learner">
                <span class="name">{{ l.last_name }}, {{ l.first_name }}</span>
                <div class="seg">
                  @for (s of statuses; track s) {
                    <button type="button" class="opt {{ s }}" [class.on]="statusOf(l.id) === s" (click)="setStatus(l.id, s)">{{ labels[s] }}</button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .field { display: grid; gap: 4px; font-size: 0.82rem; color: var(--muted); font-weight: 600; }
    .field select, .field input { font-weight: 500; color: var(--ink); }
    .row.wrap { flex-wrap: wrap; gap: 14px; }
    .counts { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill { font-size: 0.8rem; font-weight: 600; padding: 4px 12px; border-radius: 999px; }
    .pill.present { background: var(--success-soft); color: var(--success); }
    .pill.absent { background: var(--danger-soft); color: var(--danger); }
    .pill.late { background: var(--warning-soft); color: var(--warning); }

    .roster { display: grid; gap: 6px; }
    .learner { display: flex; align-items: center; gap: 12px; padding: 8px 2px; border-top: 1px solid var(--line); }
    .learner:first-child { border-top: none; }
    .name { flex: 1; min-width: 0; font-weight: 500; color: var(--title); }
    .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: var(--card); }
    .opt { border: none; background: transparent; padding: 7px 14px; font: inherit; font-weight: 600; font-size: 0.85rem; color: var(--muted); cursor: pointer; border-left: 1px solid var(--line); }
    .opt:first-child { border-left: none; }
    .opt.on.present { background: var(--success-soft); color: var(--success); }
    .opt.on.absent { background: var(--danger-soft); color: var(--danger); }
    .opt.on.late { background: var(--warning-soft); color: var(--warning); }
  `,
})
export class AttendancePage {
  protected readonly staff = inject(StaffService);

  protected readonly statuses: AttStatus[] = ['present', 'absent', 'late'];
  protected readonly labels: Record<AttStatus, string> = { present: 'Present', absent: 'Absent', late: 'Late' };
  protected readonly todayIso = new Date().toISOString().slice(0, 10);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly classOptions = signal<ClassOption[]>([]);
  protected readonly selectedClassId = signal<string>('');
  protected readonly date = signal<string>(this.todayIso);
  protected readonly learners = signal<Learner[]>([]);
  protected readonly marks = signal<Record<string, AttStatus>>({});
  protected readonly taken = signal(false);

  constructor() {
    void this.load();
  }

  protected statusOf(learnerId: string): AttStatus {
    return this.marks()[learnerId] ?? 'present';
  }
  protected count(status: AttStatus): number {
    return this.learners().filter((l) => this.statusOf(l.id) === status).length;
  }

  protected setStatus(learnerId: string, status: AttStatus): void {
    this.marks.set({ ...this.marks(), [learnerId]: status });
  }
  protected markAllPresent(): void {
    const m: Record<string, AttStatus> = {};
    for (const l of this.learners()) m[l.id] = 'present';
    this.marks.set(m);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const classes = this.staff.isAdmin() ? await this.staff.classes() : await this.staff.myClasses();
      const options = (classes as (MyClass | { id: string; grade_code: string; name: string })[])
        .map((c) => ({ id: c.id, label: `${c.grade_code} ${c.name}` }));
      this.classOptions.set(options);
      if (options.length > 0) this.selectedClassId.set(options[0].id);
      await this.loadRegister();
    } catch (err) {
      console.error(err);
      this.error.set('Could not load attendance.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadRegister(): Promise<void> {
    this.error.set(null);
    this.notice.set(null);
    if (!this.selectedClassId() || !this.date()) {
      this.learners.set([]); this.marks.set({}); this.taken.set(false);
      return;
    }
    const [learners, records] = await Promise.all([
      this.staff.classLearners(this.selectedClassId()),
      this.staff.classAttendance(this.selectedClassId(), this.date()),
    ]);
    this.learners.set(learners);
    const map: Record<string, AttStatus> = {};
    for (const l of learners) map[l.id] = 'present';
    for (const r of records) map[r.learner_id] = r.status as AttStatus;
    this.marks.set(map);
    this.taken.set(records.length > 0);
  }

  protected async save(): Promise<void> {
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try {
      const rows = this.learners().map((l) => ({
        class_id: this.selectedClassId(), learner_id: l.id, attendance_date: this.date(), status: this.statusOf(l.id),
      }));
      await this.staff.saveAttendance(rows);
      this.taken.set(true);
      this.notice.set('Register saved.');
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : 'Could not save the register.');
    } finally {
      this.busy.set(false);
    }
  }

  protected exportRegister(): void {
    const cls = this.classOptions().find((c) => c.id === this.selectedClassId());
    const rows = [...this.learners()]
      .sort((a, b) => a.last_name.localeCompare(b.last_name))
      .map((l, i) => ({ '#': i + 1, Surname: l.last_name, 'First name': l.first_name, Status: this.labels[this.statusOf(l.id)] }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Register');
    XLSX.writeFile(book, `Attendance - ${cls?.label} ${this.date()}.xlsx`);
  }
}
