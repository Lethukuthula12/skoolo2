import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CALENDAR_KIND_LABELS, CalendarItemRow, CalendarKind, MyClass, StaffService,
} from '@skoolo/shared';
import type { Tables } from '@skoolo/shared';

type Subject = Tables<'subjects'>;
interface ItemForm {
  title: string; kind: CalendarKind; event_date: string; classId: string; subjectId: string; starts_at: string; notes: string;
}

@Component({
  selector: 'app-calendar-page',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="stack">
      <div class="toolbar">
        <div>
          <h1>Calendar</h1>
          <p class="muted">{{ staff.isAdmin() ? 'Dated items your teachers have added.' : 'Your tests, assignment dates and outings.' }}</p>
        </div>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else {
        @if (myStaffId()) {
          <div class="card stack">
            <h2>Add an item</h2>
            <form class="stack" (ngSubmit)="add()">
              <div class="row wrap">
                <input type="text" [(ngModel)]="form.title" name="title" placeholder="e.g. Spelling test" class="grow" />
                <select [(ngModel)]="form.kind" name="kind">
                  @for (k of kinds; track k) { <option [value]="k">{{ kindLabels[k] }}</option> }
                </select>
                <input type="date" [(ngModel)]="form.event_date" name="date" />
                <input type="time" [(ngModel)]="form.starts_at" name="time" />
              </div>
              <div class="row wrap">
                <select [(ngModel)]="form.classId" name="class" (ngModelChange)="onClassChange($event)">
                  <option value="">No class</option>
                  @for (c of myClasses(); track c.id) { <option [value]="c.id">{{ c.name }} ({{ c.grade_code }})</option> }
                </select>
                <select [(ngModel)]="form.subjectId" name="subject" [disabled]="formSubjects().length === 0">
                  <option value="">No subject</option>
                  @for (s of formSubjects(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                </select>
                <input type="text" [(ngModel)]="form.notes" name="notes" placeholder="Notes (optional)" class="grow" />
                <button class="btn btn-primary btn-sm" type="submit" [disabled]="busy()">Add</button>
              </div>
            </form>
          </div>
        }

        <div class="card stack">
          <h2>Upcoming</h2>
          @if (items().length === 0) {
            <div class="empty">Nothing on the calendar yet.</div>
          } @else {
            <ul class="items">
              @for (it of items(); track it.id) {
                <li>
                  <div class="date">
                    <strong>{{ it.event_date | date: 'd MMM' }}</strong>
                    <span>{{ it.event_date | date: 'EEE' }}</span>
                  </div>
                  <div class="body">
                    <div class="line">
                      <span class="badge kind-{{ it.kind }}">{{ kindLabels[it.kind] }}</span>
                      <strong>{{ it.title }}</strong>
                      @if (it.starts_at) { <span class="muted small">{{ fmtTime(it.starts_at) }}</span> }
                    </div>
                    <p class="meta">
                      @if (it.classes) { {{ it.classes.name }} }
                      @if (it.subjects) { · {{ it.subjects.name }} }
                      @if (it.notes) { <span class="notes">— {{ it.notes }}</span> }
                    </p>
                  </div>
                  @if (it.staff_member_id === myStaffId()) {
                    <button class="btn btn-ghost btn-sm" type="button" (click)="remove(it)" [disabled]="busy()">Remove</button>
                  }
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .row.wrap { flex-wrap: wrap; gap: 8px; align-items: center; }
    .grow { flex: 1 1 180px; min-width: 160px; }
    .items { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .items li { display: flex; gap: 14px; align-items: center; padding: 10px 6px; border-top: 1px solid var(--line); }
    .items li:first-child { border-top: none; }
    .date { text-align: center; min-width: 48px; }
    .date strong { display: block; font-size: 0.95rem; }
    .date span { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; }
    .body { flex: 1; min-width: 0; }
    .line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .meta { margin: 2px 0 0; color: var(--muted); font-size: 0.85rem; }
    .notes { color: var(--ink); }
    .badge { font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--brand-soft); color: var(--brand); }
    .badge.kind-test { background: #fde8e8; color: #c0392b; }
    .badge.kind-assignment { background: #e8f0fe; color: #1a56db; }
    .badge.kind-outing { background: #e6f6ed; color: #1e8e5a; }
    .badge.kind-event { background: #fff3e0; color: #b7791f; }
  `,
})
export class CalendarPage {
  protected readonly staff = inject(StaffService);

  protected readonly kinds: CalendarKind[] = ['test', 'assignment', 'outing', 'event', 'other'];
  protected readonly kindLabels = CALENDAR_KIND_LABELS;

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly myStaffId = signal<string | null>(null);
  protected readonly myClasses = signal<MyClass[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly items = signal<CalendarItemRow[]>([]);
  protected readonly formSubjects = signal<Subject[]>([]);

  protected form: ItemForm = this.blankForm();

  constructor() {
    void this.load();
  }

  protected fmtTime(t: string | null): string {
    return (t ?? '').slice(0, 5);
  }

  private blankForm(): ItemForm {
    return { title: '', kind: 'test', event_date: new Date().toISOString().slice(0, 10), classId: '', subjectId: '', starts_at: '', notes: '' };
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [staffId, myClasses, subjects, items] = await Promise.all([
        this.staff.myStaffMemberId(),
        this.staff.myClasses(),
        this.staff.subjects(),
        this.staff.calendarItems(),
      ]);
      this.myStaffId.set(staffId);
      this.myClasses.set(myClasses);
      this.subjects.set(subjects);
      this.items.set(items);
    } catch (err) {
      console.error(err);
      this.error.set('Could not load the calendar.');
    } finally {
      this.loading.set(false);
    }
  }

  protected onClassChange(classId: string): void {
    this.form.subjectId = '';
    const cls = this.myClasses().find((c) => c.id === classId);
    this.formSubjects.set(cls ? this.subjects().filter((s) => s.grade_code === cls.grade_code) : []);
  }

  protected async add(): Promise<void> {
    const f = this.form;
    if (!f.title.trim() || !f.event_date) { this.error.set('Give the item a title and a date.'); return; }
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try {
      await this.staff.addCalendarItem({
        title: f.title.trim(),
        kind: f.kind,
        event_date: f.event_date,
        class_id: f.classId || null,
        subject_id: f.subjectId || null,
        starts_at: f.starts_at || null,
        notes: f.notes.trim() || null,
      });
      this.items.set(await this.staff.calendarItems());
      this.form = this.blankForm();
      this.formSubjects.set([]);
      this.notice.set('Added to the calendar.');
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : 'Could not add the item.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(item: CalendarItemRow): Promise<void> {
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try {
      await this.staff.deleteCalendarItem(item.id);
      this.items.set(await this.staff.calendarItems());
    } catch (err) {
      console.error(err);
      this.error.set('Could not remove the item.');
    } finally {
      this.busy.set(false);
    }
  }
}
