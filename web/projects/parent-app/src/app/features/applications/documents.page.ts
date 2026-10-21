import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList,
  IonNote, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import {
  ApplicationDocument, ApplicationService, ApplicationSummary, DOCUMENT_TYPE_LABELS, DocumentType,
  REQUIRED_DOCUMENT_TYPES,
} from '@skoolo/shared';

const OPTIONAL_DOCUMENT_TYPES: readonly DocumentType[] = ['latest_report', 'immunisation_card'];

@Component({
  selector: 'app-documents-page',
  imports: [
    NgTemplateOutlet, RouterLink,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList,
    IonNote, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="/applications" text="" /></ion-buttons>
        <ion-title>Documents</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (!application()) {
        <div class="centered"><p>We could not find that application.</p></div>
      } @else {
        <div class="form-card">
          <h2>Upload {{ application()?.learner?.first_name }}'s documents</h2>
          <p class="hint">
            Take a clear photo of each document or choose a PDF. The school sees these with the application.
          </p>

          <ion-list lines="full" class="documents">
            @for (type of requiredTypes; track type) {
              <ng-container *ngTemplateOutlet="row; context: { type: type, required: true }" />
            }
            @for (type of optionalTypes; track type) {
              <ng-container *ngTemplateOutlet="row; context: { type: type, required: false }" />
            }
          </ion-list>

          @if (error()) { <p class="error-text">{{ error() }}</p> }

          <ion-button expand="block" size="large" [disabled]="!allRequiredUploaded()" [routerLink]="['/applications', id(), 'payment']">
            Continue to payment
          </ion-button>
          @if (!allRequiredUploaded()) {
            <p class="hint small">Upload the three required documents to continue.</p>
          }
        </div>
      }
    </ion-content>

    <ng-template #row let-type="type" let-required="required">
      <ion-item>
        <ion-icon slot="start" [name]="uploaded(type) ? 'checkmark-circle-outline' : 'document-text-outline'"
                  [color]="uploaded(type) ? 'success' : 'medium'" />
        <ion-label>
          <h3>{{ label(type) }} @if (!required) { <ion-note>(optional)</ion-note> }</h3>
          @if (uploaded(type); as doc) {
            <p>{{ doc.file_name }}</p>
          } @else {
            <p>Not uploaded yet</p>
          }
        </ion-label>
        <ion-button slot="end" fill="outline" size="small" (click)="pick(type)" [disabled]="busyType() === type">
          @if (busyType() === type) {
            <ion-spinner name="dots" />
          } @else {
            <ion-icon slot="start" [name]="uploaded(type) ? 'refresh-outline' : 'camera-outline'" />
            {{ uploaded(type) ? 'Replace' : 'Add' }}
          }
        </ion-button>
      </ion-item>
    </ng-template>

    <input #fileInput type="file" accept="image/*,application/pdf" capture="environment" hidden (change)="onFileChosen($event)" />
  `,
  styles: `
    .form-card { display: grid; gap: 14px; }
    h2 { margin: 0; font-size: 1.3rem; font-weight: 700; }
    .hint { margin: -6px 0 0; color: rgba(20, 33, 61, 0.7); font-size: 0.92rem; line-height: 1.4; }
    .hint.small { font-size: 0.82rem; text-align: center; margin: 0; }
    .documents { background: transparent; margin: 0 -16px; }
    .documents ion-item { --background: transparent; }
    .documents h3 { font-weight: 600; font-size: 0.98rem; }
    .documents ion-note { font-size: 0.8rem; }
    ion-button[size='large'] { --border-radius: 12px; font-weight: 700; }
  `,
})
export class DocumentsPage {
  readonly id = input.required<string>();

  private readonly applications = inject(ApplicationService);

  protected readonly requiredTypes = REQUIRED_DOCUMENT_TYPES;
  protected readonly optionalTypes = OPTIONAL_DOCUMENT_TYPES;

  protected readonly application = signal<ApplicationSummary | null>(null);
  protected readonly documents = signal<ApplicationDocument[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyType = signal<DocumentType | null>(null);
  protected readonly error = signal<string | null>(null);
  private pendingType: DocumentType | null = null;
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly allRequiredUploaded = computed(() =>
    this.requiredTypes.every((type) => this.documents().some((d) => d.document_type === type)),
  );

  constructor() {
    effect(() => {
      void this.load(this.id());
    });
  }

  protected label(type: DocumentType): string {
    return DOCUMENT_TYPE_LABELS[type];
  }

  protected uploaded(type: DocumentType): ApplicationDocument | undefined {
    return this.documents().find((d) => d.document_type === type);
  }

  protected pick(type: DocumentType): void {
    this.pendingType = type;
    this.error.set(null);
    const input = this.fileInput().nativeElement;
    input.value = '';
    input.click();
  }

  protected async onFileChosen(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    const type = this.pendingType;
    if (!file || !type) return;
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('That file is larger than 10 MB. Please take a smaller photo.');
      return;
    }
    this.busyType.set(type);
    try {
      await this.applications.uploadDocument(this.id(), type, file);
      this.documents.set(await this.applications.documents(this.id()));
    } catch (err) {
      console.error(err);
      this.error.set('Upload failed. Check your connection and try again.');
    } finally {
      this.busyType.set(null);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const [application, documents] = await Promise.all([
        this.applications.byId(id),
        this.applications.documents(id),
      ]);
      this.application.set(application);
      this.documents.set(documents);
    } finally {
      this.loading.set(false);
    }
  }
}
