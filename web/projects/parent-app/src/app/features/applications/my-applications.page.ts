import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonRefresher,
  IonRefresherContent, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import type { RefresherCustomEvent } from '@ionic/angular/standalone';
import {
  APPLICATION_STATUS_LABELS, ApplicationService, ApplicationStatus, ApplicationSummary, PAYMENT_STATUS_LABELS,
} from '@skoolo/shared';

@Component({
  selector: 'app-my-applications-page',
  imports: [
    DatePipe, RouterLink,
    IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonRefresher,
    IonRefresherContent, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/" text="" /></ion-buttons>
        <ion-title>My applications</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content /></ion-refresher>
      <div class="screen-intro"><p class="eyebrow">THE NEXT STEP</p><h1>Every application, in one place.</h1><p>Follow progress, add documents and manage enrolment fees.</p></div>

      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (error()) {
        <div class="centered"><ion-icon name="alert-circle-outline" /><p role="alert">{{ error() }}</p><ion-button fill="outline" (click)="load()">Retry</ion-button></div>
      } @else if (applications().length === 0) {
        <div class="centered">
          <ion-icon name="folder-open-outline" size="large" />
          <p>You have not applied to a school yet.</p>
          <ion-button fill="outline" routerLink="/schools">Find a school</ion-button>
        </div>
      } @else {
        @for (app of applications(); track app.id) {
          <article class="form-card application">
            <header>
              <div>
                <h2>{{ app.learner.first_name }} {{ app.learner.last_name }}</h2>
                <p>{{ app.school.name }} · {{ app.period_grade.grades?.label }}</p>
              </div>
              <ion-badge [color]="statusColor(app.status)">{{ statusLabels[app.status] }}</ion-badge>
            </header>

            <p class="meta">
              Applied {{ app.submitted_at | date: 'd MMM yyyy' }} · Ref <strong>{{ app.payment_reference }}</strong>
            </p>
            <p class="meta payment" [class.good]="app.payment_status === 'confirmed'">
              <ion-icon [name]="app.payment_status === 'confirmed' ? 'checkmark-circle-outline' : 'wallet-outline'" />
              {{ paymentLabels[app.payment_status] }}
            </p>

            @if (app.status !== 'declined' && app.status !== 'withdrawn') {
              <div class="actions">
                <ion-button fill="outline" size="small" [routerLink]="['/applications', app.id, 'documents']">
                  <ion-icon slot="start" name="document-text-outline" /> Documents
                </ion-button>
                @if (app.payment_status !== 'confirmed') {
                  <ion-button size="small" [routerLink]="['/applications', app.id, 'payment']">
                    <ion-icon slot="start" name="wallet-outline" /> {{ app.payment_status === 'unpaid' ? 'Pay fee' : 'Payment' }}
                  </ion-button>
                }
              </div>
            }
          </article>
        }
      }
    </ion-content>
  `,
  styles: `
    .application { display: grid; gap: 8px; }
    header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    header > div { flex: 1 1 200px; min-width: 0; }
    h2 { margin: 0; font-size: 18px; font-weight: 600; }
    header p { margin: 4px 0 0; color: var(--skoolo-muted); font-size: 12px; }
    ion-badge { white-space: nowrap; flex-shrink: 0; }
    .meta { margin: 0; font-size: 12px; color: var(--skoolo-muted); display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .payment.good { color: var(--ion-color-success-shade); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
  `,
})
export class MyApplicationsPage {
  private readonly applications$ = inject(ApplicationService);

  protected readonly statusLabels = APPLICATION_STATUS_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;
  protected readonly applications = signal<ApplicationSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ionViewWillEnter(): void {
    void this.load();
  }

  protected statusColor(status: ApplicationStatus): string {
    switch (status) {
      case 'accepted': return 'success';
      case 'declined': return 'danger';
      case 'withdrawn': return 'medium';
      case 'more_info_needed': return 'warning';
      case 'waitlisted': return 'tertiary';
      default: return 'primary';
    }
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    await event.target.complete();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.applications.set(await this.applications$.mine());
    } catch {
      this.error.set('We couldn’t load your applications. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
