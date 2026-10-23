import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, MessagingService, StaffService, ThreadMessage, ThreadRow } from '@skoolo/shared';

interface ClassOption { id: string; grade_code: string; name: string; }

@Component({
  selector: 'app-messages-page',
  imports: [DatePipe, FormsModule],
  template: `
    <div class="stack">
      <div class="toolbar">
        <div>
          <h1>Messages</h1>
          <p class="muted">Conversations with families. Replies reach the parents connected to each learner.</p>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-outline" type="button" (click)="composing.set(!composing())">Message a class</button>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      @if (composing()) {
        <form class="card stack" (ngSubmit)="sendClass()">
          <h2>Message a whole class</h2>
          <p class="muted small">Each family gets their own private conversation, so replies stay between you and that parent.</p>
          <div class="form-grid">
            <div class="field"><label>Class</label>
              <select [(ngModel)]="classId" name="class">
                <option value="">Choose…</option>
                @for (c of classes(); track c.id) { <option [value]="c.id">{{ c.grade_code }} {{ c.name }}</option> }
              </select>
            </div>
            <div class="field"><label>Subject</label><input type="text" [(ngModel)]="subject" name="subject" /></div>
          </div>
          <div class="field"><label>Message</label><textarea [(ngModel)]="body" name="body"></textarea></div>
          <div class="row">
            <button class="btn btn-primary" type="submit" [disabled]="busy() || !classId || !subject.trim() || !body.trim()">Send to class</button>
            <button class="btn btn-outline" type="button" (click)="composing.set(false)">Cancel</button>
          </div>
        </form>
      }

      <div class="columns">
        <div class="card stack list">
          @if (loading()) { <div class="loading-state" role="status"><span class="sr-only">Loading school information…</span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span></div> }
          @else if (threads().length === 0) { <div class="empty">No conversations yet.</div> }
          @else {
            @for (t of threads(); track t.id) {
              <button class="thread" type="button" [class.active]="open()?.id === t.id" (click)="openThread(t)">
                <strong>{{ t.learners?.first_name }} {{ t.learners?.last_name }}</strong>
                <span>{{ t.subject }}</span>
                <span class="muted small">{{ t.last_message_at | date: 'd MMM, HH:mm' }}</span>
              </button>
            }
          }
        </div>

        <div class="card stack convo">
          @if (!open()) {
            <div class="empty">Pick a conversation to read and reply.</div>
          } @else {
            <h2>{{ open()!.learners?.first_name }} {{ open()!.learners?.last_name }} · {{ open()!.subject }}</h2>
            <div class="messages">
              @for (m of messages(); track m.id) {
                <div class="bubble" [class.mine]="m.sender_id === userId()">
                  <p>{{ m.body }}</p>
                  <span class="when">{{ m.created_at | date: 'd MMM, HH:mm' }}</span>
                </div>
              }
            </div>
            <div class="composer">
              <textarea [(ngModel)]="reply" name="reply" placeholder="Write a reply" rows="2"></textarea>
              <button class="btn btn-primary" type="button" (click)="send()" [disabled]="!reply.trim() || busy()">Send</button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .columns { display: grid; gap: 16px; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
    @media (max-width: 800px) { .columns { grid-template-columns: 1fr; } }
    .list .thread { display: grid; gap: 2px; width: 100%; text-align: left; background: transparent; border: none; border-radius: 10px; padding: 10px 12px; cursor: pointer; }
    .list .thread:hover { background: var(--bg); } .list .thread.active { background: var(--brand-soft); }
    .messages { display: grid; gap: 8px; max-height: 50vh; overflow-y: auto; }
    .bubble { max-width: 80%; padding: 8px 12px; border-radius: 12px; background: var(--bg); justify-self: start; }
    .bubble.mine { background: var(--brand); color: var(--brand-contrast); justify-self: end; }
    .bubble p { margin: 0; white-space: pre-wrap; } .bubble .when { font-size: 0.72rem; opacity: 0.7; }
    .composer { display: flex; gap: 8px; align-items: end; } .composer textarea { flex: 1; }
    select, .field { width: 100%; }
  `,
})
export class MessagesPage {
  private readonly messaging = inject(MessagingService);
  private readonly staff = inject(StaffService);
  private readonly auth = inject(AuthService);

  protected readonly threads = signal<ThreadRow[]>([]);
  protected readonly open = signal<ThreadRow | null>(null);
  protected readonly messages = signal<ThreadMessage[]>([]);
  protected readonly classes = signal<ClassOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly composing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected reply = '';
  protected classId = '';
  protected subject = '';
  protected body = '';

  constructor() {
    void this.load();
  }

  protected userId(): string | undefined {
    return this.auth.user()?.id;
  }

  protected async openThread(t: ThreadRow): Promise<void> {
    this.open.set(t);
    this.messages.set(await this.messaging.threadMessages(t.id));
  }

  protected async send(): Promise<void> {
    const t = this.open();
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

  protected async sendClass(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const n = await this.messaging.messageClass(this.classId, this.subject.trim(), this.body.trim());
      this.subject = '';
      this.body = '';
      this.composing.set(false);
      await this.load();
      this.notice.set(`Sent to ${n} families.`);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.threads.set(await this.messaging.allThreads());
      if (this.classes().length === 0) {
        const options = this.staff.isAdmin()
          ? (await this.staff.classes(new Date().getFullYear() + 1)).map((c) => ({ id: c.id, grade_code: c.grade_code, name: c.name }))
          : (await this.staff.myClasses()).map((c) => ({ id: c.id, grade_code: c.grade_code, name: c.name }));
        this.classes.set(options);
      }
    } catch (err) {
      console.error(err);
      this.error.set('Could not load messages.');
    } finally {
      this.loading.set(false);
    }
  }
}
