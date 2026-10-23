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
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="/children" text="" /></ion-buttons>
        <ion-title>School calendar</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
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
    .daygroup { display: flex; gap: 14px; padding: 12px 4px; border-top: 1px solid rgba(20,33,61,0.08); }
    .daygroup:first-child { border-top: none; }
    .date { text-align: center; min-width: 52px; }
    .date strong { display: block; font-size: 1rem; }
    .date span { font-size: 0.72rem; color: rgba(20,33,61,0.6); text-transform: uppercase; }
    .events { flex: 1; display: grid; gap: 10px; min-width: 0; }
    .event { display: flex; gap: 10px; align-items: flex-start; }
    .info { min-width: 0; }
    .info strong { font-size: 0.98rem; }
    .info p { margin: 1px 0 0; font-size: 0.85rem; }
    .notes { color: var(--ion-text-color); }
    .badge { font-size: 0.72rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: rgba(31,75,216,0.1); color: var(--ion-color-primary); white-space: nowrap; }
    .badge.kind-test { background: #fde8e8; color: #c0392b; }
    .badge.kind-assignment { background: #e8f0fe; color: #1a56db; }
    .badge.kind-outing { background: #e6f6ed; color: #1e8e5a; }
    .badge.kind-event { background: #fff3e0; color: #b7791f; }
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
