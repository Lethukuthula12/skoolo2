import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRefresher,
  IonRefresherContent, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import type { RefresherCustomEvent } from '@ionic/angular/standalone';
import { ApplicationService, Message } from '@skoolo/shared';

@Component({
  selector: 'app-inbox-page',
  imports: [
    DatePipe, RouterLink,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRefresher,
    IonRefresherContent, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/" text="" /></ion-buttons>
        <ion-title>Inbox</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content /></ion-refresher>
      <div class="screen-intro"><p class="eyebrow">STAY IN THE LOOP</p><h1>Your school inbox.</h1><p>Updates about your applications. For teacher conversations, open Messages on your child’s card.</p></div>

      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (error()) {
        <div class="centered"><ion-icon name="alert-circle-outline" /><p role="alert">{{ error() }}</p><ion-button fill="outline" (click)="load()">Retry</ion-button></div>
      } @else if (messages().length === 0) {
        <div class="centered">
          <ion-icon name="mail-open-outline" size="large" />
          <p>No messages yet. Schools will write to you here about your applications.</p>
        </div>
      } @else {
        <ion-list lines="full" class="inbox">
          @for (message of messages(); track message.id) {
            <ion-item button detail="false" (click)="toggle(message)" [class.unread]="!message.is_read" [attr.aria-expanded]="openId() === message.id">
              <ion-icon slot="start" [name]="message.is_read ? 'mail-open-outline' : 'mail-outline'"
                        [color]="message.is_read ? 'medium' : 'primary'" />
              <ion-label class="ion-text-wrap">
                <h3>{{ message.subject }}</h3>
                <p class="when">{{ message.created_at | date: 'd MMM yyyy, HH:mm' }}</p>
                @if (openId() === message.id) {
                  <p class="body">{{ message.body }}</p>
                  @if (message.application_id) {
                    <a [routerLink]="['/applications']" (click)="$event.stopPropagation()">View application</a>
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
    .inbox { background: transparent; padding: 0 0 20px; width: calc(100% - 40px); max-width: 760px; margin: auto; }
    ion-item { --background: #fff; margin: 0 0 14px; border: 1px solid var(--skoolo-line); border-radius: 16px; --border-color: transparent; --padding-start: 18px; --inner-padding-end: 18px; --padding-top: 10px; --padding-bottom: 10px; }
    ion-item.unread { border-left: 3px solid var(--ion-color-primary); }
    ion-item > ion-icon { font-size: 22px; margin-right: 16px; }
    ion-item.unread h3 { font-weight: 700; }
    h3 { font-size: 14px; line-height: 1.6; }
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
  protected readonly error = signal<string | null>(null);

  ionViewWillEnter(): void {
    void this.load();
  }

  protected async toggle(message: Message): Promise<void> {
    this.openId.set(this.openId() === message.id ? null : message.id);
    if (!message.is_read) {
      try {
        await this.applications.markMessageRead(message.id);
        this.messages.update((list) => list.map((m) => (m.id === message.id ? { ...m, is_read: true } : m)));
      } catch { /* Keep the unread state when saving fails; the message remains readable. */ }
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
      this.messages.set(await this.applications.messages());
    } catch {
      this.error.set('We couldn’t load your inbox. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
