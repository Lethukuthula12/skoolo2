import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TablePagination } from '../../ui/table-pagination';
import { TablePaginationComponent } from '../../ui/table-pagination.component';
import * as XLSX from 'xlsx';
import { FEE_PLAN_LABELS, FeeAccountRow, FeePayment, Grade, SchoolDirectoryService, StaffService } from '@skoolo/shared';

interface ClassOption { id: string; grade_code: string; name: string; }
interface PaymentForm { amount: number | null; method: string; reference: string; paid_on: string; note: string; }

@Component({
  selector: 'app-fees-page',
  imports: [DatePipe, FormsModule, TablePaginationComponent],
  templateUrl: './fees.page.html',
  styleUrl: './fees.page.scss',
})
export class FeesPage {
  private readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);

  protected readonly planLabels = FEE_PLAN_LABELS;
  protected readonly tab = signal<'setup' | 'payments'>('payments');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly year = signal(new Date().getFullYear() + 1);
  protected readonly grades = signal<Grade[]>([]);
  protected readonly classes = signal<ClassOption[]>([]);
  protected readonly accounts = signal<FeeAccountRow[]>([]);
  protected readonly structure = signal<Record<string, { annual: number; discount: number }>>({});
  protected readonly arrearsOnly = signal(false);
  protected readonly search = signal('');
  protected readonly sort = signal('name');

  protected readonly expandedId = signal<string | null>(null);
  protected readonly payments = signal<FeePayment[]>([]);
  protected readonly paymentsLoading = signal(false);
  protected readonly paymentsError = signal<string | null>(null);
  protected paymentForm: PaymentForm = { amount: null, method: 'eft', reference: '', paid_on: new Date().toISOString().slice(0, 10), note: '' };

  protected newAccounts = { classId: '', plan: 'monthly' };

  protected readonly schoolGrades = computed(() => {
    const s = this.staff.currentSchool();
    const lo = this.grades().find((g) => g.code === s?.lowest_grade)?.sort_order ?? 0;
    const hi = this.grades().find((g) => g.code === s?.highest_grade)?.sort_order ?? 99;
    return this.grades().filter((g) => g.sort_order >= lo && g.sort_order <= hi);
  });

  protected readonly shownAccounts = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.accounts().filter(a => (!this.arrearsOnly() || Number(a.balance) > 0) &&
      [a.learner?.first_name, a.learner?.last_name, a.payment_reference].join(' ').toLowerCase().includes(term))
      .sort((a, b) => this.sort() === 'balance' ? Number(b.balance) - Number(a.balance) :
        (a.learner?.last_name ?? '').localeCompare(b.learner?.last_name ?? '') ||
        (a.learner?.first_name ?? '').localeCompare(b.learner?.first_name ?? ''));
  });
  protected readonly pagination = new TablePagination(this.shownAccounts,
    computed(() => [this.search(), this.arrearsOnly(), this.sort(), this.year()]));
  protected readonly totalArrears = computed(() => this.accounts().reduce((sum, a) => sum + Math.max(0, Number(a.balance)), 0));

  constructor() {
    void this.load();
  }

  protected money(v: number | string | null): string {
    return `R ${Number(v ?? 0).toFixed(2)}`;
  }
  protected gradeLabel(code: string): string {
    return this.grades().find((g) => g.code === code)?.label ?? code;
  }
  protected structFor(code: string): { annual: number; discount: number } {
    return this.structure()[code] ?? { annual: 0, discount: 0 };
  }

  // ----- setup -----

  protected async saveStructure(grade: string): Promise<void> {
    const s = this.structFor(grade);
    await this.run(async () => {
      await this.staff.setFeeStructure(this.year(), grade, Number(s.annual) || 0, Number(s.discount) || 0);
      this.notice.set(`${this.gradeLabel(grade)} fee saved.`);
    });
  }

  // ----- accounts and payments -----

  protected async createAccounts(): Promise<void> {
    if (!this.newAccounts.classId) return;
    await this.run(async () => {
      const n = await this.staff.ensureFeeAccountsForClass(this.newAccounts.classId, this.year(), this.newAccounts.plan);
      await this.loadAccounts();
      this.notice.set(`Set up ${n} fee accounts.`);
    }, 'Could not create accounts. Set the fee for that grade first.');
  }

  protected async toggle(account: FeeAccountRow): Promise<void> {
    if (this.expandedId() === account.account_id) { this.expandedId.set(null); return; }
    this.expandedId.set(account.account_id);
    this.payments.set([]);
    this.paymentsLoading.set(true);
    this.paymentsError.set(null);
    this.paymentForm = { amount: null, method: 'eft', reference: '', paid_on: new Date().toISOString().slice(0, 10), note: '' };
    try {
      const payments = await this.staff.accountPayments(account.account_id!);
      if (this.expandedId() === account.account_id) this.payments.set(payments);
    } catch {
      if (this.expandedId() === account.account_id) this.paymentsError.set('Could not load payments. Close and reopen this account to try again.');
    } finally {
      if (this.expandedId() === account.account_id) this.paymentsLoading.set(false);
    }
  }

  protected async record(account: FeeAccountRow): Promise<void> {
    const f = this.paymentForm;
    if (!f.amount || f.amount <= 0) { this.error.set('Enter an amount.'); return; }
    await this.run(async () => {
      await this.staff.recordFeePayment(account.account_id!, Number(f.amount), f.method, f.reference || null, f.paid_on, f.note || null);
      this.payments.set(await this.staff.accountPayments(account.account_id!));
      await this.loadAccounts();
      this.paymentForm.amount = null; this.paymentForm.reference = ''; this.paymentForm.note = '';
      this.notice.set('Payment recorded. Confirm it when the money reflects.');
    });
  }

  protected async confirm(payment: FeePayment, account: FeeAccountRow): Promise<void> {
    await this.run(async () => {
      await this.staff.confirmFeePayment(payment.id);
      this.payments.set(await this.staff.accountPayments(account.account_id!));
      await this.loadAccounts();
      this.notice.set('Payment confirmed. The parent has been notified.');
    });
  }

  protected exportArrears(): void {
    const rows = this.accounts().filter((a) => Number(a.balance) > 0).map((a) => ({
      Surname: a.learner?.last_name ?? '', 'First name': a.learner?.first_name ?? '',
      Plan: this.planLabels[a.plan ?? ''] ?? a.plan, Reference: a.payment_reference,
      'Total due': Number(a.total_due), Paid: Number(a.total_paid), Balance: Number(a.balance),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Arrears');
    XLSX.writeFile(book, `Arrears ${this.year()}.xlsx`);
  }

  // ----- loading -----

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.grades.set(await this.directory.grades());
      this.classes.set((await this.staff.classes(this.year())).map((c) => ({ id: c.id, grade_code: c.grade_code, name: c.name })));
      await Promise.all([this.loadStructure(), this.loadAccounts()]);
    } catch (err) {
      console.error(err);
      this.error.set('Could not load fees.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadStructure(): Promise<void> {
    const list = await this.staff.feeStructures(this.year());
    const map: Record<string, { annual: number; discount: number }> = {};
    for (const s of list) map[s.grade_code] = { annual: Number(s.annual_amount), discount: Number(s.upfront_discount_percent) };
    this.structure.set(map);
  }

  private async loadAccounts(): Promise<void> {
    this.accounts.set(await this.staff.feeAccounts(this.year()));
  }

  protected async changeYear(year: number): Promise<void> {
    this.year.set(year);
    await this.run(() => this.load());
  }

  private async run(action: () => Promise<void>, failure = 'Something went wrong.'): Promise<void> {
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try { await action(); } catch (err) { console.error(err); this.error.set(failure); } finally { this.busy.set(false); }
  }
}
