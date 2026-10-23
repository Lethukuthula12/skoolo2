import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { ApplicationService, CALENDAR_KIND_LABELS, SchoolEvent } from '@skoolo/shared';

@Component({
  selector: 'app-school-calendar-page',
  imports: [DatePipe, IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/children" text="" /></ion-buttons>
        <ion-title>School calendar</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="screen-intro"><p class="eyebrow">DATES TO REMEMBER</p><h1>Coming up at school.</h1><p>Keep track of school events, assessments and activities.</p></div>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (events().length === 0) {
        <div class="centered">
          <ion-icon name="calendar-outline" size="large" />
          <p>No upcoming events. Your school's events will appear here.</p>
        </div>
      } @else {
        @for (group of grouped(); track group.date) {
          <div class="daygroup">
            <div class="date">
              <strong>{{ group.date | date: 'd MMM' }}</strong>
              <span>{{ group.date | date: 'EEEE' }}</span>
            </div>
            <div class="events">
              @for (e of group.events; track e.id) {
                <div class="event">
                  <span class="badge kind-{{ e.kind }}">{{ kindLabels[e.kind] }}</span>
                  <div class="info">
                    <strong>{{ e.title }}</strong>
                    <p class="muted">
                      {{ e.schools?.name }}@if (e.starts_at) { · {{ fmtTime(e.starts_at) }} }
                    </p>
                    @if (e.notes) { <p class="notes">{{ e.notes }}</p> }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </ion-content>
  `,
  styles: `
    .daygroup { display: flex; gap: 18px; padding: 20px; border: 1px solid var(--skoolo-line); background: var(--skoolo-surface); border-radius: 16px; margin: 16px auto; width: calc(100% - 40px); max-width: 760px; }
    .daygroup:first-child { border-top: none; }
    .date { text-align: center; min-width: 52px; }
    .date strong { display: block; font-size: 1rem; }
    .date span { font-size: 0.72rem; color: var(--skoolo-muted); text-transform: uppercase; }
    .events { flex: 1; display: grid; gap: 10px; min-width: 0; }
    .event { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; padding: 2px 0 12px; overflow-wrap: anywhere; }
    .info { min-width: 0; }
    .info strong { font-size: 0.98rem; }
    .info p { margin: 1px 0 0; font-size: 0.85rem; }
    .notes { color: var(--ion-text-color); }
    .badge { font-size: 10px; font-weight: 500; padding: 4px 9px; border-radius: 6px; background: var(--skoolo-brand-soft); color: var(--skoolo-brand-ink); white-space: nowrap; }
    .badge.kind-test { background: rgba(var(--ion-color-danger-rgb), .12); color: var(--ion-color-danger); }
    .badge.kind-assignment { background: var(--skoolo-brand-soft); color: var(--skoolo-brand-ink); }
    .badge.kind-outing { background: rgba(var(--ion-color-success-rgb), .12); color: var(--ion-color-success-shade); }
    .badge.kind-event { background: rgba(var(--ion-color-warning-rgb), .12); color: var(--ion-color-warning); }
  `,
})
export class SchoolCalendarPage {
  private readonly applications = inject(ApplicationService);

  protected readonly kindLabels = CALENDAR_KIND_LABELS;
  protected readonly loading = signal(true);
  protected readonly events = signal<SchoolEvent[]>([]);

  protected readonly grouped = computed(() => {
    const groups: { date: string; events: SchoolEvent[] }[] = [];
    for (const e of this.events()) {
      const last = groups.at(-1);
      if (last && last.date === e.event_date) last.events.push(e);
      else groups.push({ date: e.event_date, events: [e] });
    }
    return groups;
  });

  constructor() {
    void this.load();
  }

  protected fmtTime(t: string | null): string {
    return (t ?? '').slice(0, 5);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.events.set(await this.applications.schoolEvents());
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }
}
