import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { ApplicationService, GUARDIAN_RELATIONSHIPS, MyChild } from '@skoolo/shared';

@Component({
  selector: 'app-children-page',
  imports: [
    ReactiveFormsModule, RouterLink,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="/" text="" /></ion-buttons>
        <ion-title>My children</ion-title>
        <ion-buttons slot="end">
          <ion-button [routerLink]="['/notices']"><ion-icon slot="icon-only" name="notifications-outline" /></ion-button>
          <ion-button [routerLink]="['/calendar']"><ion-icon slot="icon-only" name="calendar-outline" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else {
        @if (children().length === 0) {
          <div class="centered">
            <ion-icon name="people-outline" size="large" />
            <p>No children connected yet. Enter the family code your school gave you below.</p>
          </div>
        } @else {
          @for (c of children(); track c.id) {
            <article class="form-card child">
              <div class="top">
                <div class="avatar">{{ initials(c) }}</div>
                <div>
                  <h2>{{ c.first_name }} {{ c.last_name }}</h2>
                  <p>
                    @if (c.school_name) { {{ c.school_name }} }
                    @if (c.grade_label) { · {{ c.grade_label }}@if (c.class_name) { {{ c.class_name }} } }
                  </p>
                </div>
              </div>
              <div class="actions">
                <ion-button fill="outline" size="small" [routerLink]="['/child', c.id]">Reports</ion-button>
                <ion-button fill="outline" size="small" [routerLink]="['/child', c.id, 'messages']">Messages</ion-button>
                <ion-button fill="outline" size="small" [routerLink]="['/child', c.id, 'absence']">Report absence</ion-button>
                <ion-button fill="outline" size="small" [routerLink]="['/child', c.id, 'fees']">Fees</ion-button>
              </div>
            </article>
          }
        }

        <form class="form-card" [formGroup]="form" (ngSubmit)="link()">
          <h2>Connect a child</h2>
          <p class="hint">Enter the family code your school sent you. You can add more than one child.</p>
          <ion-input label="Family code" labelPlacement="floating" fill="outline" formControlName="code" class="code" autocapitalize="characters" />
          <ion-input label="Your relationship (optional)" labelPlacement="floating" fill="outline" formControlName="relationship" placeholder="e.g. Mother" />
          @if (error()) { <p class="error-text">{{ error() }}</p> }
          @if (notice()) { <p class="notice-text">{{ notice() }}</p> }
          <ion-button expand="block" size="large" type="submit" [disabled]="form.invalid || busy()">
            @if (busy()) { <ion-spinner name="crescent" /> } @else { Connect }
          </ion-button>
        </form>
      }
    </ion-content>
  `,
  styles: `
    .child { display: grid; gap: 12px; }
    .child .top { display: flex; align-items: center; gap: 14px; }
    .child .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .child h2 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    
    .child p { margin: 2px 0 0; color: rgba(20, 33, 61, 0.7); font-size: 0.9rem; }

    .avatar { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: var(--ion-color-primary); color: #fff; font-weight: 700; flex-shrink: 0; }
    .form-card { display: grid; gap: 14px; }
    h2 { margin: 0; font-size: 1.2rem; font-weight: 700; }
    .hint { margin: -6px 0 0; color: rgba(20, 33, 61, 0.7); font-size: 0.92rem; }
    .notice-text { color: var(--ion-color-success-shade); font-size: 0.9rem; margin: 0; }
    .code input { text-transform: uppercase; letter-spacing: 0.1em; }
    ion-button[type='submit'] { margin-top: 6px; --border-radius: 12px; font-weight: 700; }
  `,
})
export class ChildrenPage {
  private readonly applications = inject(ApplicationService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly relationships = GUARDIAN_RELATIONSHIPS;
  protected readonly children = signal<MyChild[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
    relationship: [''],
  });

  constructor() {
    void this.load();
  }

  protected initials(c: MyChild): string {
    return `${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`.toUpperCase();
  }

  protected async link(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    const { code, relationship } = this.form.getRawValue();
    try {
      const child = await this.applications.redeemFamilyCode(code, relationship);
      this.notice.set(`Connected to ${child.first_name} ${child.last_name}.`);
      this.form.reset({ code: '', relationship: '' });
      await this.load();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.children.set(await this.applications.myChildren());
    } catch (err) {
      console.error(err);
      this.error.set('Could not load your children.');
    } finally {
      this.loading.set(false);
    }
  }
}
