import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { ApplicationService, AttendanceRecord } from '@skoolo/shared';

@Component({
  selector: 'app-child-attendance-page',
  imports: [DatePipe, IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/children" text="" /></ion-buttons>
        <ion-title>Attendance</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (records().length === 0) {
        <div class="centered">
          <ion-icon name="checkbox-outline" size="large" />
          <p>No attendance has been recorded for your child yet.</p>
        </div>
      } @else {
        <div class="form-card rate">
          <span class="muted">Attendance rate</span>
          <strong>{{ rate() }}%</strong>
          <p class="muted">Present on {{ attended() }} of {{ total() }} school days recorded</p>
        </div>

        <div class="form-card totals">
          <div class="t present"><strong>{{ count('present') }}</strong><span>Present</span></div>
          <div class="t late"><strong>{{ count('late') }}</strong><span>Late</span></div>
          <div class="t absent"><strong>{{ count('absent') }}</strong><span>Absent</span></div>
        </div>

        <div class="form-card">
          <h2>Recent days</h2>
          @for (r of records().slice(0, 30); track r.id) {
            <div class="day">
              <span>{{ r.attendance_date | date: 'EEE d MMM yyyy' }}</span>
              <span class="badge {{ r.status }}">{{ label(r.status) }}</span>
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: `
    .form-card { display: grid; gap: 8px; }
    h2 { margin: 0 0 4px; font-size: 1.1rem; font-weight: 700; }
    .rate { text-align: center; }
    .rate strong { font-size: 2.4rem; color: var(--skoolo-brand-ink); line-height: 1; }
    .rate span { font-size: 0.9rem; }
    .totals { grid-auto-flow: column; text-align: center; }
    .t strong { display: block; font-size: 1.6rem; }
    .t span { font-size: 0.82rem; color: rgba(20,33,61,0.6); }
    .t.present strong { color: var(--ion-color-success-shade); }
    .t.late strong { color: #b7791f; }
    .t.absent strong { color: var(--ion-color-danger); }
    .day { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid rgba(20,33,61,0.08); }
    .day:first-of-type { border-top: none; }
    .badge { font-size: 0.75rem; font-weight: 700; padding: 3px 11px; border-radius: 999px; }
    .badge.present { background: rgba(30,142,90,0.14); color: var(--ion-color-success-shade); }
    .badge.late { background: rgba(183,121,31,0.14); color: #b7791f; }
    .badge.absent { background: rgba(197,0,15,0.12); color: var(--ion-color-danger); }
  `,
})
export class ChildAttendancePage {
  readonly learnerId = input.required<string>();
  private readonly applications = inject(ApplicationService);

  protected readonly loading = signal(true);
  protected readonly records = signal<AttendanceRecord[]>([]);

  protected readonly total = computed(() => this.records().length);
  protected readonly attended = computed(() => this.records().filter((r) => r.status !== 'absent').length);
  protected readonly rate = computed(() => (this.total() ? Math.round((this.attended() / this.total()) * 100) : 0));

  constructor() {
    effect(() => { void this.load(this.learnerId()); });
  }

  protected count(status: string): number {
    return this.records().filter((r) => r.status === status).length;
  }
  protected label(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  private async load(learnerId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.records.set(await this.applications.childAttendance(learnerId));
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }
}
