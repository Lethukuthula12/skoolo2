import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, CALENDAR_KIND_LABELS, CalendarItemRow, CalendarKind, MyClass, StaffService } from '@skoolo/shared';

interface DayCell { iso: string; day: number; inMonth: boolean; isToday: boolean; }
interface ClassOption { id: string; label: string; }
interface EventForm { id: string | null; title: string; kind: CalendarKind; starts_at: string; classId: string; parent_visible: boolean; notes: string; }

@Component({
  selector: 'app-calendar-page',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="stack">
      <div class="toolbar">
        <div>
          <h1>School calendar</h1>
          <p class="muted">Term dates, tests, outings and events. Click a day to add one — everyone at the school sees it, and parents see the ones you mark visible.</p>
        </div>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      <div class="card stack">
        <div class="monthbar">
          <button class="btn btn-outline btn-sm" type="button" (click)="prevMonth()">‹</button>
          <strong class="month">{{ monthLabel() }}</strong>
          <button class="btn btn-outline btn-sm" type="button" (click)="nextMonth()">›</button>
          <span class="spacer"></span>
          <button class="btn btn-ghost btn-sm" type="button" (click)="today()">Today</button>
        </div>

        @if (loading()) {
          <p class="muted">Loading…</p>
        } @else {
          <div class="cal">
            <div class="dow" aria-hidden="true">
              @for (d of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; track d) { <span>{{ d }}</span> }
            </div>
            @for (week of weeks(); track $index) {
              <div class="week">
                @for (cell of week; track cell.iso) {
                  <button type="button" class="daycell" [class.out]="!cell.inMonth" [class.today]="cell.isToday" (click)="openDay(cell.iso)">
                    <span class="num">{{ cell.day }}</span>
                    <span class="evs">
                      @for (e of eventsOn(cell.iso).slice(0, 3); track e.id) {
                        <span class="dot kind-{{ e.kind }}">{{ e.title }}</span>
                      }
                      @if (eventsOn(cell.iso).length > 3) { <span class="more">+{{ eventsOn(cell.iso).length - 3 }} more</span> }
                    </span>
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    @if (selectedDay()) {
      <div class="scrim" (click)="closeDay()"></div>
      <aside class="daypanel">
        <header>
          <strong>{{ selectedDay() | date: 'EEEE d MMMM yyyy' }}</strong>
          <button class="x" type="button" (click)="closeDay()">×</button>
        </header>

        @if (dayEvents().length > 0) {
          <ul class="evlist">
            @for (e of dayEvents(); track e.id) {
              <li>
                <span class="badge kind-{{ e.kind }}">{{ kindLabels[e.kind] }}</span>
                <div class="info">
                  <strong>{{ e.title }}</strong>
                  <span class="muted small">
                    @if (e.starts_at) { {{ fmtTime(e.starts_at) }} · }
                    {{ e.created_by_name || 'Staff' }}@if (!e.parent_visible) { · staff only }
                  </span>
                  @if (e.notes) { <span class="notes">{{ e.notes }}</span> }
                </div>
                @if (canEdit(e)) {
                  <div class="rowbtns">
                    <button class="btn btn-ghost btn-sm" type="button" (click)="editEvent(e)">Edit</button>
                    <button class="btn btn-ghost btn-sm" type="button" (click)="removeEvent(e)" [disabled]="busy()">Delete</button>
                  </div>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="muted small">No events on this day yet.</p>
        }

        <form class="stack addform" (ngSubmit)="saveEvent()">
          <strong>{{ form.id ? 'Edit event' : 'Add an event' }}</strong>
          <input type="text" [(ngModel)]="form.title" name="title" placeholder="e.g. Parents' evening" />
          <div class="row wrap">
            <select [(ngModel)]="form.kind" name="kind">
              @for (k of kinds; track k) { <option [value]="k">{{ kindLabels[k] }}</option> }
            </select>
            <input type="time" [(ngModel)]="form.starts_at" name="time" />
          </div>
          <select [(ngModel)]="form.classId" name="class">
            <option value="">Whole school (no class)</option>
            @for (c of classOptions(); track c.id) { <option [value]="c.id">{{ c.label }}</option> }
          </select>
          <input type="text" [(ngModel)]="form.notes" name="notes" placeholder="Notes (optional)" />
          <label class="checkbox"><input type="checkbox" [(ngModel)]="form.parent_visible" name="pv" /> Visible to parents</label>
          <div class="row">
            <button class="btn btn-primary btn-sm" type="submit" [disabled]="busy()">{{ form.id ? 'Save' : 'Add event' }}</button>
            @if (form.id) { <button class="btn btn-ghost btn-sm" type="button" (click)="resetForm()">Cancel</button> }
          </div>
        </form>
      </aside>
    }
  `,
  styles: `
    .monthbar { display: flex; align-items: center; gap: 10px; }
    .month { font-size: 1.1rem; color: var(--title); min-width: 160px; text-align: center; }
    .cal { display: grid; gap: 6px; }
    .dow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .dow span { text-align: center; font-size: 0.72rem; font-weight: 600; color: var(--muted); text-transform: uppercase; }
    .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .daycell {
      min-height: 86px; border: 1px solid var(--line); border-radius: 10px; background: var(--card);
      padding: 6px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; overflow: hidden;
      transition: border-color 100ms ease, box-shadow 100ms ease;
      &:hover { border-color: var(--brand); box-shadow: var(--shadow); }
    }
    .daycell.out { background: var(--surface-2); }
    .daycell.out .num { color: var(--muted); }
    .daycell.today { border-color: var(--brand); box-shadow: 0 0 0 1px var(--brand) inset; }
    .daycell .num { font-weight: 600; font-size: 0.85rem; }
    .daycell .evs { display: grid; gap: 2px; min-width: 0; }
    .dot { font-size: 0.7rem; padding: 1px 6px; border-radius: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--brand-soft); color: var(--brand); }
    .more { font-size: 0.68rem; color: var(--muted); }
    .dot.kind-test { background: #fde8e8; color: #c0392b; }
    .dot.kind-assignment, .badge.kind-assignment { background: #e8f0fe; color: #1a56db; }
    .dot.kind-outing, .badge.kind-outing { background: #e6f6ed; color: #1e8e5a; }
    .dot.kind-event, .badge.kind-event { background: #fff3e0; color: #b7791f; }
    .badge.kind-test { background: #fde8e8; color: #c0392b; }

    .scrim { position: fixed; inset: 0; background: rgba(20, 20, 40, 0.3); z-index: 45; }
    .daypanel {
      position: fixed; top: 0; right: 0; z-index: 46; width: min(380px, 92vw); height: 100vh;
      background: var(--card); box-shadow: -8px 0 32px rgba(0, 0, 0, 0.18); padding: 20px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 14px;
    }
    .daypanel header { display: flex; align-items: center; justify-content: space-between; }
    .daypanel header strong { font-size: 1.05rem; color: var(--title); }
    .daypanel .x { border: none; background: transparent; font-size: 1.6rem; line-height: 1; color: var(--muted); cursor: pointer; }
    .evlist { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .evlist li { display: flex; gap: 10px; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
    .evlist .info { flex: 1; min-width: 0; display: grid; gap: 1px; }
    .evlist .info strong { color: var(--title); }
    .evlist .notes { font-size: 0.85rem; color: var(--ink); }
    .rowbtns { display: grid; gap: 2px; }
    .addform { border-top: 1px solid var(--line); padding-top: 12px; }
    .row.wrap { flex-wrap: wrap; gap: 8px; }
  `,
})
export class CalendarPage {
  protected readonly staff = inject(StaffService);
  private readonly auth = inject(AuthService);

  protected readonly kindLabels = CALENDAR_KIND_LABELS;
  protected readonly kinds: CalendarKind[] = ['event', 'test', 'assignment', 'outing', 'other'];

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly items = signal<CalendarItemRow[]>([]);
  protected readonly classOptions = signal<ClassOption[]>([]);
  protected readonly monthCursor = signal<{ year: number; month: number }>({ year: new Date().getFullYear(), month: new Date().getMonth() });
  protected readonly selectedDay = signal<string | null>(null);
  protected form: EventForm = this.blankForm();

  private readonly monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  protected readonly monthLabel = computed(() => `${this.monthNames[this.monthCursor().month]} ${this.monthCursor().year}`);

  /** Six Monday-first weeks covering the current month. */
  protected readonly weeks = computed<DayCell[][]>(() => {
    const { year, month } = this.monthCursor();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday = 0
    const todayIso = this.toIso(new Date());
    const grid: DayCell[][] = [];
    for (let w = 0; w < 6; w++) {
      const week: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(year, month, 1 - startOffset + w * 7 + d);
        const iso = this.toIso(date);
        week.push({ iso, day: date.getDate(), inMonth: date.getMonth() === month, isToday: iso === todayIso });
      }
      grid.push(week);
    }
    // drop a trailing week entirely outside the month
    return grid.filter((wk, i) => i < 5 || wk.some((c) => c.inMonth));
  });

  private readonly byDate = computed(() => {
    const map = new Map<string, CalendarItemRow[]>();
    for (const e of this.items()) {
      const list = map.get(e.event_date) ?? [];
      list.push(e);
      map.set(e.event_date, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''));
    return map;
  });

  protected readonly dayEvents = computed(() => (this.selectedDay() ? this.eventsOn(this.selectedDay()!) : []));

  constructor() {
    void this.load();
  }

  protected eventsOn(iso: string): CalendarItemRow[] {
    return this.byDate().get(iso) ?? [];
  }

  protected fmtTime(t: string | null): string {
    return (t ?? '').slice(0, 5);
  }

  protected canEdit(e: CalendarItemRow): boolean {
    return this.staff.isAdmin() || e.created_by === this.auth.user()?.id;
  }

  private blankForm(): EventForm {
    return { id: null, title: '', kind: 'event', starts_at: '', classId: '', parent_visible: true, notes: '' };
  }
  protected resetForm(): void {
    this.form = this.blankForm();
  }

  protected prevMonth(): void {
    const { year, month } = this.monthCursor();
    this.monthCursor.set(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  }
  protected nextMonth(): void {
    const { year, month } = this.monthCursor();
    this.monthCursor.set(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  }
  protected today(): void {
    this.monthCursor.set({ year: new Date().getFullYear(), month: new Date().getMonth() });
  }

  protected openDay(iso: string): void {
    this.selectedDay.set(iso);
    this.resetForm();
    this.error.set(null);
  }
  protected closeDay(): void {
    this.selectedDay.set(null);
    this.resetForm();
  }

  protected editEvent(e: CalendarItemRow): void {
    this.form = {
      id: e.id, title: e.title, kind: (e.kind as CalendarKind), starts_at: e.starts_at ?? '',
      classId: e.class_id ?? '', parent_visible: e.parent_visible, notes: e.notes ?? '',
    };
  }

  protected async saveEvent(): Promise<void> {
    const f = this.form;
    const day = this.selectedDay();
    if (!day) return;
    if (!f.title.trim()) { this.error.set('Give the event a title.'); return; }
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try {
      const payload = {
        title: f.title.trim(), kind: f.kind, event_date: day,
        starts_at: f.starts_at || null, class_id: f.classId || null,
        parent_visible: f.parent_visible, notes: f.notes.trim() || null,
      };
      if (f.id) await this.staff.updateCalendarItem(f.id, payload);
      else await this.staff.addCalendarItem(payload);
      await this.reload();
      this.resetForm();
      this.notice.set('Calendar updated.');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not save the event.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async removeEvent(e: CalendarItemRow): Promise<void> {
    if (!confirm(`Remove "${e.title}"?`)) return;
    this.busy.set(true); this.error.set(null);
    try {
      await this.staff.deleteCalendarItem(e.id);
      await this.reload();
    } catch {
      this.error.set('Could not remove the event.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [items, classes] = await Promise.all([
        this.staff.calendarItems(),
        this.staff.isAdmin() ? this.staff.classes() : this.staff.myClasses(),
      ]);
      this.items.set(items);
      this.classOptions.set((classes as (MyClass | { id: string; grade_code: string; name: string })[]).map((c) => ({
        id: c.id, label: `${c.grade_code} ${c.name}`,
      })));
    } catch (err) {
      console.error(err);
      this.error.set('Could not load the calendar.');
    } finally {
      this.loading.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.items.set(await this.staff.calendarItems());
  }

  private toIso(date: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }
}
