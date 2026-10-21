import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRefresher,
  IonRefresherContent, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import type { RefresherCustomEvent } from '@ionic/angular/standalone';
import { ApplicationService, Message } from '@skoolo/shared';

@Component({
  selector: 'app-inbox-page',
  imports: [
    DatePipe, RouterLink,
    IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRefresher,
    IonRefresherContent, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="/" text="" /></ion-buttons>
        <ion-title>Messages</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content /></ion-refresher>

      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (messages().length === 0) {
        <div class="centered">
          <ion-icon name="mail-open-outline" size="large" />
          <p>No messages yet. Schools will write to you here about your applications.</p>
        </div>
      } @else {
        <ion-list lines="full" class="inbox">
          @for (message of messages(); track message.id) {
            <ion-item button detail="false" (click)="toggle(message)" [class.unread]="!message.is_read">
              <ion-icon slot="start" [name]="message.is_read ? 'mail-open-outline' : 'mail-outline'"
                        [color]="message.is_read ? 'medium' : 'primary'" />
              <ion-label class="ion-text-wrap">
                <h3>{{ message.subject }}</h3>
                <p class="when">{{ message.created_at | date: 'd MMM yyyy, HH:mm' }}</p>
                @if (openId() === message.id) {
                  <p class="body">{{ message.body }}</p>
                  @if (message.application_id) {
                    <a [routerLink]="['/applications']">View application</a>
                  }
                } @else {
                  <p class="preview">{{ message.body }}</p>
                }
              </ion-label>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: `
    .inbox { background: transparent; padding: 8px 0; }
    ion-item { --background: #fff; margin: 0 12px 8px; border-radius: 12px; --border-color: transparent; }
    ion-item.unread h3 { font-weight: 700; }
    h3 { font-size: 1rem; }
    .when { font-size: 0.8rem; color: rgba(20, 33, 61, 0.6); }
    .preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .body { white-space: pre-wrap; line-height: 1.45; margin-top: 6px; color: var(--ion-text-color); }
    a { display: inline-block; margin-top: 8px; font-weight: 600; }
  `,
})
export class InboxPage {
  private readonly applications = inject(ApplicationService);

  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(true);
  protected readonly openId = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async toggle(message: Message): Promise<void> {
    this.openId.set(this.openId() === message.id ? null : message.id);
    if (!message.is_read) {
      this.messages.update((list) => list.map((m) => (m.id === message.id ? { ...m, is_read: true } : m)));
      await this.applications.markMessageRead(message.id);
    }
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    await event.target.complete();
  }

  private async load(): Promise<void> {
    try {
      this.messages.set(await this.applications.messages());
    } finally {
      this.loading.set(false);
    }
  }
}
