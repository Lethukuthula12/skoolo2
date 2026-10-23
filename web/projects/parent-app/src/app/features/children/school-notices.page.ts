import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { ApplicationService, ParentNotice } from '@skoolo/shared';

@Component({
  selector: 'app-school-notices-page',
  imports: [DatePipe, IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/children" text="" /></ion-buttons>
        <ion-title>Notices</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (notices().length === 0) {
        <div class="centered">
          <ion-icon name="notifications-outline" size="large" />
          <p>No notices yet. Announcements from your school will appear here.</p>
        </div>
      } @else {
        @for (n of notices(); track n.id) {
          <article class="form-card notice" [class.pinned]="n.pinned">
            <div class="top">
              <h2>{{ n.title }}</h2>
              @if (n.pinned) { <ion-icon name="pin" color="warning" /> }
            </div>
            <p class="body">{{ n.body }}</p>
            <p class="meta">{{ n.schools?.name }} · {{ n.created_at | date: 'd MMM yyyy' }}</p>
          </article>
        }
      }
    </ion-content>
  `,
  styles: `
    .notice { display: grid; gap: 4px; }
    .notice.pinned { border-left: 3px solid var(--ion-color-warning); }
    .top { display: flex; align-items: center; gap: 8px; }
    h2 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .body { white-space: pre-wrap; margin: 4px 0 0; color: var(--ion-text-color); }
    .meta { margin: 6px 0 0; font-size: 0.82rem; color: var(--skoolo-muted); }
  `,
})
export class SchoolNoticesPage {
  private readonly applications = inject(ApplicationService);

  protected readonly loading = signal(true);
  protected readonly notices = signal<ParentNotice[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.notices.set(await this.applications.parentNotices());
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }
}
