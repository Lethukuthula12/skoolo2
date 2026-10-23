import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { ApplicationService, FEE_PLAN_LABELS, FeeStatement } from '@skoolo/shared';

@Component({
  selector: 'app-child-fees-page',
  imports: [
    CurrencyPipe, DatePipe,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="/children" text="" /></ion-buttons>
        <ion-title>School fees</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (!statement() || !statement()!.instructions) {
        <div class="centered">
          <ion-icon name="wallet-outline" size="large" />
          <p>No fee account has been set up for your child yet. The school will add one.</p>
        </div>
      } @else {
        @let s = statement()!.instructions!;
        <div class="form-card balance" [class.clear]="+s.balance <= 0">
          <span>Balance owing</span>
          <strong>{{ +s.balance | currency: 'ZAR' : 'R ' : '1.2-2' }}</strong>
          <p class="muted">{{ planLabels[s.plan] }} · paid {{ +s.total_paid | currency: 'ZAR' : 'R ' : '1.2-2' }} of {{ +s.total_due | currency: 'ZAR' : 'R ' : '1.2-2' }}</p>
        </div>

        @if (+s.balance > 0 && s.bank_name) {
          <div class="form-card">
            <h2>How to pay</h2>
            <p class="hint">Pay by EFT from your banking app using the reference below, or in cash at the school office.</p>
            @if (s.monthly) { <p>Monthly: <strong>{{ +s.monthly | currency: 'ZAR' : 'R ' : '1.2-2' }}</strong></p> }
            <div class="reference">
              <span>Payment reference</span>
              <strong>{{ s.payment_reference }}</strong>
              <ion-button size="small" fill="clear" (click)="copy(s.payment_reference)"><ion-icon slot="start" name="copy-outline" /> Copy</ion-button>
            </div>
            <dl class="bank">
              <div><dt>Account holder</dt><dd>{{ s.account_holder }}</dd></div>
              <div><dt>Bank</dt><dd>{{ s.bank_name }}</dd></div>
              <div><dt>Account number</dt><dd>{{ s.account_number }}</dd></div>
              <div><dt>Branch code</dt><dd>{{ s.branch_code }}</dd></div>
            </dl>
          </div>
        }

        <div class="form-card">
          <h2>Payments</h2>
          @if (statement()!.payments.length === 0) {
            <p class="muted">No payments recorded yet.</p>
          } @else {
            @for (p of statement()!.payments; track p.id) {
              <div class="pay">
                <div>
                  <strong>{{ +p.amount | currency: 'ZAR' : 'R ' : '1.2-2' }}</strong>
                  <p class="muted">{{ p.paid_on | date: 'd MMM yyyy' }} · {{ p.method }}</p>
                </div>
                <span class="badge" [class.ok]="p.status === 'confirmed'">{{ p.status === 'confirmed' ? 'Confirmed' : 'Pending' }}</span>
              </div>
            }
          }
        </div>
      }
    </ion-content>
  `,
  styles: `
    .form-card { display: grid; gap: 10px; }
    h2 { margin: 0; font-size: 1.15rem; font-weight: 700; }
    .hint { margin: -4px 0 0; color: rgba(20,33,61,0.7); font-size: 0.9rem; }
    .balance { text-align: center; }
    .balance span { color: rgba(20,33,61,0.7); font-size: 0.9rem; }
    .balance strong { font-size: 2rem; color: var(--ion-color-danger); }
    .balance.clear strong { color: var(--ion-color-success-shade); }
    .reference { background: rgba(31,75,216,0.07); border-radius: 12px; padding: 12px; text-align: center; display: grid; gap: 2px; }
    .reference span { font-size: 0.8rem; color: rgba(20,33,61,0.7); }
    .reference strong { font-size: 1.5rem; letter-spacing: 0.08em; font-family: ui-monospace, Consolas, monospace; }
    .bank { display: grid; gap: 6px; margin: 0; }
    .bank div { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(20,33,61,0.08); padding-bottom: 4px; }
    .bank dt { color: rgba(20,33,61,0.7); font-size: 0.9rem; } .bank dd { margin: 0; font-weight: 600; }
    .pay { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid rgba(20,33,61,0.08); }
    .pay p { margin: 2px 0 0; font-size: 0.85rem; }
    .badge { font-size: 0.75rem; font-weight: 600; padding: 2px 10px; border-radius: 999px; background: rgba(183,121,31,0.14); color: #b7791f; }
    .badge.ok { background: rgba(30,142,90,0.14); color: var(--ion-color-success-shade); }
  `,
})
export class ChildFeesPage {
  readonly learnerId = input.required<string>();
  private readonly applications = inject(ApplicationService);
  private readonly toast = inject(ToastController);

  protected readonly planLabels = FEE_PLAN_LABELS;
  protected readonly statement = signal<FeeStatement | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => { void this.load(this.learnerId()); });
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      const t = await this.toast.create({ message: 'Reference copied', duration: 1500 });
      await t.present();
    } catch { /* visible on screen anyway */ }
  }

  private async load(learnerId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.statement.set(await this.applications.childFeeStatement(learnerId));
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }
}
