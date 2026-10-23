import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AbsenceRow, MessagingService } from '@skoolo/shared';

@Component({
  selector: 'app-absences-page',
  imports: [DatePipe],
  template: `
    <div class="stack">
      <div>
        <h1>Absences</h1>
        <p class="muted">Absences parents have reported. Acknowledge each so the parent knows it was received.</p>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      <div class="card stack">
        <div class="toolbar">
          <label class="checkbox"><input type="checkbox" [checked]="pendingOnly()" (change)="pendingOnly.set($any($event.target).checked)" /> Pending only</label>
          <span class="spacer"></span>
          <span class="muted small">{{ shown().length }} of {{ absences().length }}</span>
        </div>
        @if (loading()) {
          <p class="muted">Loading…</p>
        } @else if (shown().length === 0) {
          <div class="empty">No absences{{ pendingOnly() ? ' waiting' : '' }}.</div>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Learner</th><th>Dates</th><th>Reason</th><th>Note</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (a of shown(); track a.id) {
                  <tr>
                    <td><strong>{{ a.learners?.last_name }}, {{ a.learners?.first_name }}</strong></td>
                    <td>{{ a.start_date | date: 'd MMM' }} – {{ a.end_date | date: 'd MMM yyyy' }}</td>
                    <td>{{ a.reason }}@if (a.note) { <br /><span class="muted small">{{ a.note }}</span> }</td>
                    <td>@if (a.document_path) { <button class="btn btn-ghost btn-sm" type="button" (click)="openNote(a)">Open</button> } @else { — }</td>
                    <td><span class="badge" [class.badge-success]="a.status === 'acknowledged'" [class.badge-warning]="a.status === 'reported'">{{ a.status === 'acknowledged' ? 'Noted' : 'Reported' }}</span></td>
                    <td class="right">@if (a.status === 'reported') { <button class="btn btn-primary btn-sm" type="button" (click)="acknowledge(a)" [disabled]="busy()">Acknowledge</button> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: `.checkbox { display: inline-flex; gap: 8px; align-items: center; font-weight: 500; } .right { text-align: right; }`,
})
export class AbsencesPage {
  private readonly messaging = inject(MessagingService);

  protected readonly absences = signal<AbsenceRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly pendingOnly = signal(true);

  protected readonly shown = computed(() =>
    this.pendingOnly() ? this.absences().filter((a) => a.status === 'reported') : this.absences(),
  );

  constructor() {
    void this.load();
  }

  protected async openNote(a: AbsenceRow): Promise<void> {
    if (!a.document_path) return;
    try {
      window.open(await this.messaging.absenceNoteUrl(a.document_path), '_blank', 'noopener');
    } catch (err) {
      console.error(err);
      this.error.set('Could not open that note.');
    }
  }

  protected async acknowledge(a: AbsenceRow): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.messaging.acknowledgeAbsence(a.id);
      await this.load();
      this.notice.set('Acknowledged. The parent has been notified.');
    } catch (err) {
      console.error(err);
      this.error.set('Could not acknowledge.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.absences.set(await this.messaging.schoolAbsences());
    } catch (err) {
      console.error(err);
      this.error.set('Could not load absences.');
    } finally {
      this.loading.set(false);
    }
  }
}
