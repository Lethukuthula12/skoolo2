import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  APPLICATION_STATUS_LABELS, ApplicationDocument, ApplicationStatus, DOCUMENT_TYPE_LABELS, PAYMENT_STATUS_LABELS,
  StaffApplication, StaffService, StatusHistoryEntry,
} from '@skoolo/shared';
import { allowedNextStatuses, paymentBadgeClass, statusBadgeClass } from './badges';

@Component({
  selector: 'app-application-detail-page',
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!app()) {
      <div class="card">
        <p>Application not found.</p>
        <a routerLink="/applications" class="btn btn-outline">Back to applications</a>
      </div>
    } @else {
      @let a = app()!;
      <div class="stack">
        <div class="toolbar">
          <a routerLink="/applications" class="btn btn-ghost btn-sm">← Applications</a>
        </div>

        <div class="header">
          <div>
            <h1>{{ a.learner.first_name }} {{ a.learner.last_name }}</h1>
            <p class="muted">
              {{ a.period_grade.grades?.label }} · submitted {{ a.submitted_at | date: 'd MMM yyyy, HH:mm' }} ·
              reference <code>{{ a.payment_reference }}</code>
            </p>
          </div>
          <div class="row">
            <span class="badge" [class]="'badge ' + statusClass(a.status)">{{ statusLabels[a.status] }}</span>
            <span class="badge" [class]="'badge ' + paymentClass(a.payment_status)">{{ paymentLabels[a.payment_status] }}</span>
          </div>
        </div>

        @if (notice()) { <p class="ok">{{ notice() }}</p> }
        @if (error()) { <p class="error">{{ error() }}</p> }

        <div class="columns">
          <div class="stack">
            <section class="card">
              <h2>Learner</h2>
              <dl class="facts">
                <dt>Date of birth</dt><dd>{{ a.learner.date_of_birth | date: 'd MMMM yyyy' }}</dd>
                <dt>Gender</dt><dd>{{ a.learner.gender }}</dd>
                @if (a.learner.identity_number) { <dt>ID number</dt><dd>{{ a.learner.identity_number }}</dd> }
                @if (a.learner.passport_number) { <dt>Passport</dt><dd>{{ a.learner.passport_number }} ({{ a.learner.nationality }})</dd> }
                @if (a.learner.home_language) { <dt>Home language</dt><dd>{{ a.learner.home_language }}</dd> }
                @if (a.learner.previous_school) { <dt>Previous school</dt><dd>{{ a.learner.previous_school }}</dd> }
              </dl>
            </section>

            <section class="card">
              <h2>Parent or guardian</h2>
              <dl class="facts">
                <dt>Name</dt><dd>{{ a.guardian_full_name || a.parent.full_name }}@if (a.guardian_relationship) { <span class="muted">({{ a.guardian_relationship }})</span> }</dd>
                @if (a.guardian_identity_number) { <dt>ID / passport</dt><dd>{{ a.guardian_identity_number }}</dd> }
                <dt>Phone</dt><dd><a [href]="'tel:' + (a.guardian_phone || a.parent.phone)">{{ a.guardian_phone || a.parent.phone }}</a></dd>
                <dt>Email</dt><dd><a [href]="'mailto:' + a.parent.email">{{ a.parent.email }}</a></dd>
                @if (a.guardian_full_name && a.guardian_full_name !== a.parent.full_name) {
                  <dt>Account holder</dt><dd>{{ a.parent.full_name }} · {{ a.parent.phone }}</dd>
                }
                <dt>Address</dt>
                <dd>{{ a.address_line }}@if (a.suburb) {, {{ a.suburb }}}<br />{{ a.town }}, {{ a.province }} {{ a.postal_code }}</dd>
                <dt>School transport</dt>
                <dd>
                  @if (a.uses_school_transport === true) { Yes @if (a.transport_provider_name) { · {{ a.transport_provider_name }} } }
                  @else if (a.uses_school_transport === false) { No }
                  @else { Not answered }
                </dd>
                @if (a.parent_note) { <dt>Note from parent</dt><dd>{{ a.parent_note }}</dd> }
              </dl>
            </section>

            <section class="card">
              <h2>Documents</h2>
              @if (a.application_documents.length === 0) {
                <p class="muted">No documents uploaded yet.</p>
              } @else {
                <table class="data">
                  <tbody>
                    @for (doc of sortedDocuments(); track doc.id) {
                      <tr>
                        <td><strong>{{ documentLabels[doc.document_type] }}</strong><br /><span class="muted small">{{ doc.file_name }} · {{ doc.created_at | date: 'd MMM yyyy' }}</span></td>
                        <td class="right"><button class="btn btn-outline btn-sm" type="button" (click)="openDocument(doc)">Open</button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </section>

            <section class="card">
              <h2>History</h2>
              <ul class="timeline">
                @for (h of history(); track h.id) {
                  <li>
                    <span>
                      @if (h.from_status) { {{ statusLabels[h.from_status] }} → } {{ statusLabels[h.to_status] }}
                    </span>
                    @if (h.note) { <span class="muted small">{{ h.note }}</span> }
                    <span class="when">{{ h.created_at | date: 'd MMM yyyy, HH:mm' }}</span>
                  </li>
                }
              </ul>
            </section>
          </div>

          <div class="stack">
            @if (!staff.isAdmin()) {
              <section class="card"><p class="muted">Only school administrators can confirm payments or change the status.</p></section>
            } @else {
            <section class="card">
              <h2>Payment</h2>
              @if (a.payment_status === 'confirmed') {
                <p class="ok">Confirmed {{ a.payment_confirmed_at | date: 'd MMM yyyy, HH:mm' }}.</p>
              } @else {
                <p class="muted">
                  Look for reference <code>{{ a.payment_reference }}</code> on the school's bank statement.
                  @if (a.payment_status === 'marked_paid') { The parent reported paying on {{ a.marked_paid_at | date: 'd MMM yyyy, HH:mm' }}. }
                  @else { The parent has not reported a payment yet. }
                </p>
                <div class="field">
                  <label for="payNote">Note (optional, kept internal)</label>
                  <input id="payNote" type="text" [(ngModel)]="paymentNote" placeholder="e.g. R500 received 22 Oct" />
                </div>
                <button class="btn btn-success" type="button" (click)="confirmPayment()" [disabled]="busy()">
                  Confirm payment received
                </button>
                <p class="muted small">This accepts the application and sends the parent a welcome message.</p>
              }
            </section>

            <section class="card">
              <h2>Status</h2>
              @if (nextStatuses().length === 0) {
                <p class="muted">This application is closed.</p>
              } @else {
                <div class="field">
                  <label for="nextStatus">Move to</label>
                  <select id="nextStatus" [(ngModel)]="nextStatus">
                    <option value="">Choose…</option>
                    @for (s of nextStatuses(); track s) { <option [value]="s">{{ statusLabels[s] }}</option> }
                  </select>
                </div>
                <div class="field">
                  <label for="statusNote">Message to the parent (optional)</label>
                  <textarea id="statusNote" [(ngModel)]="statusNote" placeholder="Shown to the parent in their inbox, e.g. which document is missing"></textarea>
                </div>
                <button class="btn btn-primary" type="button" (click)="updateStatus()" [disabled]="!nextStatus || busy()">Update status</button>
              }
            </section>

            <section class="card">
              <h2>Message the parent</h2>
              <div class="field">
                <label for="msgSubject">Subject</label>
                <input id="msgSubject" type="text" [(ngModel)]="messageSubject" />
              </div>
              <div class="field">
                <label for="msgBody">Message</label>
                <textarea id="msgBody" [(ngModel)]="messageBody"></textarea>
              </div>
              <button class="btn btn-outline" type="button" (click)="sendMessage()" [disabled]="!messageSubject.trim() || !messageBody.trim() || busy()">Send</button>
            </section>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .columns { display: grid; gap: 16px; grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr); }
    @media (max-width: 900px) { .columns { grid-template-columns: 1fr; } }
    section.card { display: grid; gap: 12px; }
    section.card h2 { margin: 0; }
    .right { text-align: right; }
    code { font-size: 0.9rem; }
  `,
})
export class ApplicationDetailPage {
  readonly id = input.required<string>();

  protected readonly staff = inject(StaffService);

  protected readonly statusLabels = APPLICATION_STATUS_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;
  protected readonly documentLabels = DOCUMENT_TYPE_LABELS;
  protected readonly statusClass = statusBadgeClass;
  protected readonly paymentClass = paymentBadgeClass;

  protected readonly app = signal<StaffApplication | null>(null);
  protected readonly history = signal<StatusHistoryEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected paymentNote = '';
  protected nextStatus: ApplicationStatus | '' = '';
  protected statusNote = '';
  protected messageSubject = '';
  protected messageBody = '';

  protected readonly nextStatuses = computed(() => {
    const current = this.app();
    return current ? allowedNextStatuses(current.status) : [];
  });

  protected readonly sortedDocuments = computed(() =>
    [...(this.app()?.application_documents ?? [])].sort((x, y) => x.document_type.localeCompare(y.document_type)),
  );

  constructor() {
    effect(() => {
      void this.load(this.id());
    });
  }

  protected async openDocument(doc: ApplicationDocument): Promise<void> {
    try {
      const url = await this.staff.documentUrl(doc.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      console.error(err);
      this.error.set('Could not open that document.');
    }
  }

  protected async confirmPayment(): Promise<void> {
    await this.run(async () => {
      await this.staff.confirmPayment(this.id(), this.paymentNote.trim() || undefined);
      this.paymentNote = '';
      this.notice.set('Payment confirmed. The parent has been sent a welcome message.');
    });
  }

  protected async updateStatus(): Promise<void> {
    if (!this.nextStatus) return;
    const status = this.nextStatus;
    await this.run(async () => {
      await this.staff.setStatus(this.id(), status, this.statusNote.trim() || undefined);
      this.nextStatus = '';
      this.statusNote = '';
      this.notice.set(`Status updated to ${APPLICATION_STATUS_LABELS[status]}. The parent has been notified.`);
    });
  }

  protected async sendMessage(): Promise<void> {
    const current = this.app();
    if (!current) return;
    await this.run(async () => {
      await this.staff.sendMessage(current, this.messageSubject.trim(), this.messageBody.trim());
      this.messageSubject = '';
      this.messageBody = '';
      this.notice.set('Message sent.');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
      await this.load(this.id());
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(this.app() === null);
    try {
      const [app, history] = await Promise.all([this.staff.application(id), this.staff.history(id)]);
      this.app.set(app);
      this.history.set(history);
    } finally {
      this.loading.set(false);
    }
  }
}
