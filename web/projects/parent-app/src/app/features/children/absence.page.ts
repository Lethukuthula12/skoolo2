import { DatePipe } from '@angular/common';
import { Component, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSelect, IonSelectOption,
  IonSpinner, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { ActionFeedbackComponent, AbsenceReport, ApplicationService, MessagingService } from '@skoolo/shared';

const REASONS = ['Illness', 'Medical appointment', 'Family responsibility', 'Religious observance', 'Other'];

@Component({
  selector: 'app-absence-page',
  imports: [ActionFeedbackComponent,
    DatePipe, ReactiveFormsModule, RouterLink,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSelect, IonSelectOption,
    IonSpinner, IonTextarea, IonTitle, IonToolbar,
  ],
  template: `
    <skoolo-action-feedback [success]="sent() ? 'Absence report sent to the school.' : null" [error]="error()" [pending]="busy()" />
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/children" text="" /></ion-buttons>
        <ion-title>Report absence</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (sent()) {
        <div class="form-card">
          <h2>Thank you</h2>
          <p>{{ childName() }}'s absence has been sent to the school. You will get a message when they note it.</p>
          <ion-button expand="block" fill="outline" (click)="sent.set(false)">Report another</ion-button>
          <ion-button expand="block" fill="clear" routerLink="/children">Back to my children</ion-button>
        </div>
      } @else {
        <form class="form-card" [formGroup]="form" (ngSubmit)="submit()">
          <h2>Report {{ childName() }}'s absence</h2>
          <ion-input label="First day absent" labelPlacement="stacked" fill="outline" type="date" formControlName="start" />
          <ion-input label="Last day absent" labelPlacement="stacked" fill="outline" type="date" formControlName="end" />
          <ion-select label="Reason" labelPlacement="floating" fill="outline" formControlName="reason" interface="action-sheet" cancelText="Cancel">
            @for (r of reasons; track r) { <ion-select-option [value]="r">{{ r }}</ion-select-option> }
          </ion-select>
          <ion-textarea label="Anything the school should know? (optional)" labelPlacement="floating" fill="outline" formControlName="note" [autoGrow]="true" rows="2" />
          <ion-button fill="outline" size="small" type="button" (click)="pickFile()">
            <ion-icon slot="start" name="camera-outline" /> {{ fileName() || "Attach a doctor's note (optional)" }}
          </ion-button>
          <input #fileInput type="file" accept="image/*,application/pdf" hidden (change)="onFile($event)" />
          @if (error()) { <p class="error-text">{{ error() }}</p> }
          <ion-button expand="block" size="large" type="submit" [disabled]="form.invalid || busy()">
            @if (busy()) { <ion-spinner name="crescent" /> } @else { Send to school }
          </ion-button>
        </form>

        @if (history().length > 0) {
          <div class="form-card">
            <h2>Reported before</h2>
            @for (a of history(); track a.id) {
              <div class="past">
                <div>
                  <strong>{{ a.start_date | date: 'd MMM' }} – {{ a.end_date | date: 'd MMM yyyy' }}</strong>
                  <p class="muted">{{ a.reason }}</p>
                </div>
                <span class="badge" [class.ack]="a.status === 'acknowledged'">{{ a.status === 'acknowledged' ? 'Noted' : 'Sent' }}</span>
              </div>
            }
          </div>
        }
      }
    </ion-content>
  `,
  styles: `
    .form-card { display: grid; gap: 14px; }
    h2 { margin: 0; font-size: 1.2rem; font-weight: 700; }
    ion-button[type='submit'] { margin-top: 6px; --border-radius: 12px; font-weight: 700; }
    .past { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--skoolo-line); }
    .past p { margin: 2px 0 0; font-size: 0.85rem; }
    .badge { font-size: 0.75rem; font-weight: 600; padding: 2px 10px; border-radius: 999px; background: var(--skoolo-brand-soft); color: var(--skoolo-brand-ink); }
    .badge.ack { background: rgba(var(--ion-color-success-rgb), .12); color: var(--ion-color-success-shade); }
  `,
})
export class AbsencePage {
  readonly learnerId = input.required<string>();
  private readonly messaging = inject(MessagingService);
  private readonly applications = inject(ApplicationService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly reasons = REASONS;
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly childName = signal('your child');
  protected readonly fileName = signal<string | null>(null);
  protected readonly history = signal<AbsenceReport[]>([]);
  private file: File | null = null;

  protected readonly form = this.formBuilder.group({
    start: ['', Validators.required],
    end: ['', Validators.required],
    reason: ['Illness', Validators.required],
    note: [''],
  });

  constructor() {
    effect(() => {
      const id = this.learnerId();
      void this.load(id);
    });
  }

  protected pickFile(): void {
    const input = this.fileInput().nativeElement;
    input.value = '';
    input.click();
  }

  protected onFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fileName.set(this.file?.name ?? null);
  }

  protected async submit(): Promise<void> {
    const v = this.form.getRawValue();
    if (v.end < v.start) { this.error.set('The last day cannot be before the first day.'); return; }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.messaging.reportAbsence(this.learnerId(), v.start, v.end, v.reason, v.note || null, this.file);
      this.file = null;
      this.fileName.set(null);
      this.form.reset({ start: '', end: '', reason: 'Illness', note: '' });
      this.sent.set(true);
      this.history.set(await this.messaging.childAbsences(this.learnerId()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not send. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(learnerId: string): Promise<void> {
    try {
      const child = (await this.applications.myChildren()).find((c) => c.id === learnerId);
      if (child) this.childName.set(child.first_name);
      this.history.set(await this.messaging.childAbsences(learnerId));
    } catch (err) {
      console.error(err);
    }
  }
}
