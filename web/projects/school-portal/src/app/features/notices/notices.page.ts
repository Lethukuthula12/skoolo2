import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionFeedbackComponent, StaffService } from '@skoolo/shared';
import type { Tables } from '@skoolo/shared';

type Notice = Tables<'notices'>;
interface NoticeForm { id: string | null; title: string; body: string; audience: string; pinned: boolean; }

const AUDIENCE_LABELS: Record<string, string> = { all: 'Everyone', staff: 'Staff only', parents: 'Parents only' };

@Component({
  selector: 'app-notices-page',
  imports: [ActionFeedbackComponent, FormsModule, DatePipe],
  template: `
    <skoolo-action-feedback [success]="notice()" [error]="error()" [pending]="busy()" />
    <div class="stack">
      <div class="toolbar">
        <div>
          <h1>Notices</h1>
          <p class="muted">{{ staff.isAdmin() ? 'Post announcements to your staff and parents.' : 'Announcements from your school.' }}</p>
        </div>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      @if (staff.isAdmin()) {
        <div class="card stack">
          <h2>{{ form.id ? 'Edit notice' : 'New notice' }}</h2>
          <form class="stack" (ngSubmit)="save()">
            <input type="text" [(ngModel)]="form.title" name="title" placeholder="Title, e.g. School closed Friday" />
            <textarea [(ngModel)]="form.body" name="body" rows="3" placeholder="Write the announcement…"></textarea>
            <div class="row wrap">
              <label class="field">Audience
                <select [(ngModel)]="form.audience" name="audience">
                  <option value="all">Everyone (staff and parents)</option>
                  <option value="staff">Staff only</option>
                  <option value="parents">Parents only</option>
                </select>
              </label>
              <label class="checkbox"><input type="checkbox" [(ngModel)]="form.pinned" name="pinned" /> Pin to top</label>
              <span class="spacer"></span>
              @if (form.id) { <button class="btn btn-ghost btn-sm" type="button" (click)="resetForm()">Cancel</button> }
              <button class="btn btn-primary btn-sm" type="submit" [disabled]="busy()">{{ form.id ? 'Save' : 'Post notice' }}</button>
            </div>
          </form>
        </div>
      }

      @if (loading()) {
        <div class="loading-state" role="status"><span class="sr-only">Loading school information…</span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span></div>
      } @else if (items().length === 0) {
        <div class="empty">No notices yet.</div>
      } @else {
        @for (n of items(); track n.id) {
          <div class="card notice" [class.pinned]="n.pinned">
            <div class="top">
              <h2>{{ n.title }}</h2>
              <span class="spacer"></span>
              @if (n.pinned) { <span class="badge badge-warning">Pinned</span> }
              <span class="badge" [class]="audienceClass(n.audience)">{{ audienceLabel(n.audience) }}</span>
            </div>
            <p class="body">{{ n.body }}</p>
            <div class="meta">
              <span class="muted small">{{ n.created_by_name || 'Admin' }} · {{ n.created_at | date: 'd MMM yyyy' }}</span>
              @if (staff.isAdmin()) {
                <span class="spacer"></span>
                <button class="btn btn-ghost btn-sm" type="button" (click)="togglePin(n)" [disabled]="busy()">{{ n.pinned ? 'Unpin' : 'Pin' }}</button>
                <button class="btn btn-ghost btn-sm" type="button" (click)="edit(n)">Edit</button>
                <button class="btn btn-ghost btn-sm" type="button" (click)="remove(n)" [disabled]="busy()">Delete</button>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .field { display: grid; gap: 4px; font-size: 0.82rem; color: var(--muted); font-weight: 600; }
    .field select { font-weight: 500; color: var(--ink); }
    .row.wrap { flex-wrap: wrap; gap: 14px; align-items: center; }
    .notice .top { display: flex; align-items: center; gap: 10px; }
    .notice h2 { margin: 0; }
    .notice.pinned { border-left: 3px solid var(--warning); }
    .notice .body { white-space: pre-wrap; margin: 8px 0 0; }
    .meta { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
    .badge.aud-all { background: var(--brand-soft); color: var(--brand); }
    .badge.aud-staff { background: var(--surface-2); color: var(--muted); }
    .badge.aud-parents { background: var(--success-soft); color: var(--success); }
  `,
})
export class NoticesPage {
  protected readonly staff = inject(StaffService);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<Notice[]>([]);
  protected form: NoticeForm = this.blankForm();

  constructor() {
    void this.load();
  }

  protected audienceLabel(a: string): string { return AUDIENCE_LABELS[a] ?? a; }
  protected audienceClass(a: string): string { return `aud-${a}`; }

  private blankForm(): NoticeForm {
    return { id: null, title: '', body: '', audience: 'all', pinned: false };
  }
  protected resetForm(): void { this.form = this.blankForm(); }

  protected edit(n: Notice): void {
    this.form = { id: n.id, title: n.title, body: n.body, audience: n.audience, pinned: n.pinned };
  }

  protected async save(): Promise<void> {
    const f = this.form;
    if (!f.title.trim() || !f.body.trim()) { this.error.set('Give the notice a title and a message.'); return; }
    await this.run(async () => {
      await this.staff.saveNotice({ id: f.id ?? undefined, title: f.title.trim(), body: f.body.trim(), audience: f.audience, pinned: f.pinned });
      this.resetForm();
      await this.reload();
      this.notice.set('Notice posted.');
    });
  }

  protected async togglePin(n: Notice): Promise<void> {
    await this.run(async () => {
      await this.staff.saveNotice({ id: n.id, title: n.title, body: n.body, audience: n.audience, pinned: !n.pinned });
      await this.reload();
      this.notice.set(n.pinned ? 'Notice unpinned.' : 'Notice pinned.');
    });
  }

  protected async remove(n: Notice): Promise<void> {
    if (!confirm(`Delete "${n.title}"?`)) return;
    await this.run(async () => {
      await this.staff.deleteNotice(n.id);
      this.notice.set('Notice removed.');
      if (this.form.id === n.id) this.resetForm();
      await this.reload();
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try { this.items.set(await this.staff.notices()); }
    catch (err) { console.error(err); this.error.set('Could not load notices.'); }
    finally { this.loading.set(false); }
  }
  private async reload(): Promise<void> { this.items.set(await this.staff.notices()); }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try { await action(); }
    catch (err) { console.error(err); this.error.set(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { this.busy.set(false); }
  }
}
