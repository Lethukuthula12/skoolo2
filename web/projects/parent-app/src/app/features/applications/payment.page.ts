import { CurrencyPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { ApplicationService, PaymentInstructions } from '@skoolo/shared';

@Component({
  selector: 'app-payment-page',
  imports: [
    CurrencyPipe, RouterLink,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/applications" text="" /></ion-buttons>
        <ion-title>Enrolment fee</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (!instructions()) {
        <div class="centered"><p>We could not load the payment details.</p></div>
      } @else {
        @let p = instructions()!;

        @switch (p.payment_status) {
          @case ('confirmed') {
            <div class="form-card status confirmed">
              <ion-icon name="checkmark-circle-outline" />
              <h2>Payment confirmed</h2>
              <p>{{ p.school_name }} has confirmed your payment. Check your messages for the welcome note.</p>
              <ion-button expand="block" routerLink="/inbox"><ion-icon slot="start" name="mail-outline" /> Open messages</ion-button>
            </div>
          }
          @case ('marked_paid') {
            <div class="form-card status pending">
              <ion-icon name="time-outline" />
              <h2>Thank you, payment reported</h2>
              <p>
                {{ p.school_name }} will match your payment against reference
                <strong>{{ p.payment_reference }}</strong> and confirm it. You will get a message here when they do.
              </p>
              <ion-button expand="block" fill="outline" routerLink="/applications">My applications</ion-button>
            </div>
          }
          @default {
            <div class="form-card">
              <h2>Pay the enrolment fee</h2>
              <p class="hint">
                Pay by EFT from your banking app, then tap <strong>I have paid</strong>. The school confirms once the
                money reflects.
              </p>

              <div class="amount">
                <span>Amount</span>
                <strong>{{ p.fee_amount | currency: p.currency : 'R ' : '1.2-2' }}</strong>
              </div>

              <div class="reference">
                <span>Your payment reference</span>
                <strong>{{ p.payment_reference }}</strong>
                <ion-button size="small" fill="clear" (click)="copy(p.payment_reference, 'Reference copied')">
                  <ion-icon slot="start" name="copy-outline" /> Copy
                </ion-button>
                <p>Use this exact reference so the school can find your payment.</p>
              </div>

              @if (p.bank_name) {
                <dl class="bank">
                  <div><dt>Account holder</dt><dd>{{ p.account_holder }}</dd></div>
                  <div><dt>Bank</dt><dd>{{ p.bank_name }}</dd></div>
                  <div><dt>Account type</dt><dd>{{ p.account_type }}</dd></div>
                  <div>
                    <dt>Account number</dt>
                    <dd>
                      {{ p.account_number }}
                      <ion-button size="small" fill="clear" (click)="copy(p.account_number, 'Account number copied')">
                        <ion-icon slot="icon-only" name="copy-outline" />
                      </ion-button>
                    </dd>
                  </div>
                  <div><dt>Branch code</dt><dd>{{ p.branch_code }}</dd></div>
                </dl>
              } @else {
                <p class="error-text">The school has not added its banking details yet. Please contact the school office.</p>
              }

              @if (p.instructions) { <p class="hint">{{ p.instructions }}</p> }
              @if (error()) { <p class="error-text">{{ error() }}</p> }

              <ion-button expand="block" size="large" [disabled]="busy() || !p.bank_name" (click)="markPaid()">
                @if (busy()) { <ion-spinner name="crescent" /> } @else { I have paid }
              </ion-button>
              <ion-button expand="block" fill="clear" color="medium" routerLink="/applications">Pay later</ion-button>
            </div>
          }
        }
      }
    </ion-content>
  `,
  styles: `
    .form-card { display: grid; gap: 14px; }
    h2 { margin: 0; font-size: 1.3rem; font-weight: 700; }
    .hint { margin: -6px 0 0; color: var(--skoolo-muted); font-size: 0.92rem; line-height: 1.4; }
    .amount { display: flex; justify-content: space-between; align-items: baseline; font-size: 1rem; }
    .amount strong { font-size: 1.6rem; }
    .reference { background: var(--skoolo-brand-soft); border-radius: 12px; padding: 14px; text-align: center; display: grid; gap: 4px; }
    .reference span { font-size: 0.85rem; color: var(--skoolo-muted); }
    .reference strong { font-size: 1.7rem; letter-spacing: 0.08em; font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; }
    .reference p { margin: 0; font-size: 0.82rem; color: var(--skoolo-muted); }
    .bank { display: grid; gap: 8px; margin: 0; }
    .bank div { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 1px solid var(--skoolo-line); padding-bottom: 6px; }
    .bank dt { color: var(--skoolo-muted); font-size: 0.9rem; }
    .bank dd { margin: 0; font-weight: 600; display: flex; align-items: center; gap: 2px; }
    ion-button[size='large'] { --border-radius: 12px; font-weight: 700; }
    .status { text-align: center; }
    .status ion-icon { font-size: 64px; }
    .status.confirmed ion-icon { color: var(--ion-color-success); }
    .status.pending ion-icon { color: var(--skoolo-brand-ink); }
    .status p { color: var(--skoolo-muted); line-height: 1.45; }
  `,
})
export class PaymentPage {
  readonly id = input.required<string>();

  private readonly applications = inject(ApplicationService);
  private readonly toast = inject(ToastController);

  protected readonly instructions = signal<PaymentInstructions | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      void this.load(this.id());
    });
  }

  protected async copy(value: string, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      const toast = await this.toast.create({ message, duration: 1500, position: 'bottom' });
      await toast.present();
    } catch {
      // Clipboard can be unavailable in some webviews; the value is still visible on screen.
    }
  }

  protected async markPaid(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.applications.markPaid(this.id());
      await this.load(this.id());
    } catch (err) {
      console.error(err);
      this.error.set('Could not record your payment. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      this.instructions.set(await this.applications.paymentInstructions(id));
    } finally {
      this.loading.set(false);
    }
  }
}
