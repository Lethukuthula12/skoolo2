import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSpinner, IonTextarea,
  IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService, MessageThread, MessagingService, ThreadMessage } from '@skoolo/shared';

@Component({
  selector: 'app-child-messages-page',
  imports: [
    DatePipe, FormsModule,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSpinner, IonTextarea,
    IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/children" text="" /></ion-buttons>
        <ion-title>{{ openThread() ? openThread()!.subject : 'Messages' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (openThread(); as t) {
        <div class="thread">
          @for (m of messages(); track m.id) {
            <div class="bubble" [class.mine]="m.sender_id === userId()">
              <p>{{ m.body }}</p>
              <span class="when">{{ m.created_at | date: 'd MMM, HH:mm' }}</span>
            </div>
          }
        </div>
        <div class="composer">
          <ion-textarea [(ngModel)]="reply" placeholder="Write a reply" fill="outline" [autoGrow]="true" rows="1" />
          <ion-button (click)="send()" [disabled]="!reply.trim() || busy()" aria-label="Send">
            <ion-icon slot="icon-only" name="send-outline" />
          </ion-button>
        </div>
      } @else {
        <div class="form-card">
          <h2>Message the school</h2>
          <ion-input label="Subject" labelPlacement="floating" fill="outline" [(ngModel)]="newSubject" />
          <ion-textarea label="Message" labelPlacement="floating" fill="outline" [(ngModel)]="newBody" [autoGrow]="true" rows="2" />
          @if (error()) { <p class="error-text">{{ error() }}</p> }
          <ion-button expand="block" (click)="startNew()" [disabled]="!newSubject.trim() || !newBody.trim() || busy()">Send</ion-button>
        </div>

        @if (threads().length > 0) {
          <h3 class="section">Conversations</h3>
          @for (th of threads(); track th.id) {
            <button class="thread-row" type="button" (click)="open(th)">
              <div>
                <strong>{{ th.subject }}</strong>
                <p class="muted">{{ th.last_message_at | date: 'd MMM yyyy, HH:mm' }}</p>
              </div>
              <ion-icon name="chevron-forward-outline" />
            </button>
          }
        } @else {
          <p class="centered muted">No conversations yet. Start one above.</p>
        }
      }
    </ion-content>
  `,
  styles: `
    .thread { display: grid; gap: 8px; padding: 12px; }
    .bubble { max-width: 80%; padding: 10px 12px; border-radius: 14px; background: #fff; box-shadow: 0 1px 2px rgba(20,33,61,0.06); justify-self: start; }
    .bubble.mine { background: var(--ion-color-primary); color: #fff; justify-self: end; }
    .bubble p { margin: 0; white-space: pre-wrap; }
    .bubble .when { font-size: 0.72rem; opacity: 0.7; }
    .composer { display: flex; gap: 8px; align-items: end; padding: 10px 12px; position: sticky; bottom: 0; background: var(--ion-background-color); }
    .composer ion-textarea { flex: 1; }
    .form-card { display: grid; gap: 12px; }
    h2 { margin: 0; font-size: 1.15rem; font-weight: 700; }
    .section { margin: 16px 16px 0; }
    .thread-row { display: flex; justify-content: space-between; align-items: center; width: calc(100% - 24px); margin: 8px 12px 0; background: #fff; border: none; border-radius: 12px; padding: 14px; text-align: left; font: inherit; cursor: pointer; }
    .thread-row p { margin: 2px 0 0; font-size: 0.82rem; }
  `,
})
export class ChildMessagesPage {
  readonly learnerId = input.required<string>();
  private readonly messaging = inject(MessagingService);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly threads = signal<MessageThread[]>([]);
  protected readonly openThread = signal<MessageThread | null>(null);
  protected readonly messages = signal<ThreadMessage[]>([]);

  protected reply = '';
  protected newSubject = '';
  protected newBody = '';

  constructor() {
    effect(() => {
      void this.load(this.learnerId());
    });
  }

  protected userId(): string | undefined {
    return this.auth.user()?.id;
  }

  protected async open(thread: MessageThread): Promise<void> {
    this.openThread.set(thread);
    this.messages.set(await this.messaging.threadMessages(thread.id));
  }

  protected async send(): Promise<void> {
    const t = this.openThread();
    if (!t || !this.reply.trim()) return;
    this.busy.set(true);
    try {
      await this.messaging.postMessage(t.id, this.reply.trim());
      this.reply = '';
      this.messages.set(await this.messaging.threadMessages(t.id));
    } finally {
      this.busy.set(false);
    }
  }

  protected async startNew(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = await this.messaging.startThread(this.learnerId(), this.newSubject.trim(), this.newBody.trim());
      this.newSubject = '';
      this.newBody = '';
      await this.load(this.learnerId());
      const thread = this.threads().find((t) => t.id === id);
      if (thread) await this.open(thread);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(learnerId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.threads.set(await this.messaging.threadsForLearner(learnerId));
    } finally {
      this.loading.set(false);
    }
  }
}
