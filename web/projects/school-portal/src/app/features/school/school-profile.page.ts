import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionFeedbackComponent, Grade, PROVINCES, Province, SchoolDirectoryService, StaffService } from '@skoolo/shared';

interface SchoolForm {
  name: string; tagline: string; description: string; lowest_grade: string; highest_grade: string;
  street_address: string; town: string; province: Province | ''; phone: string; secondary_phone: string; email: string; website: string; badge_url: string;
  legal_name: string; company_registration: string; npo_registration: string; tax_reference: string;
}

interface BankForm {
  account_holder: string; bank_name: string; account_type: string; account_number: string; branch_code: string;
}

@Component({
  selector: 'app-school-profile-page',
  imports: [ActionFeedbackComponent, FormsModule],
  styles: `
    .badge-card { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
    .badge-preview img, .badge-empty { width: 96px; height: 96px; border-radius: 20px; object-fit: cover; background: var(--bg); }
    .badge-empty { display: grid; place-items: center; color: var(--muted); font-size: 0.8rem; text-align: center; border: 1px dashed var(--line); }
  `,
  template: `
    <skoolo-action-feedback [success]="notice()" [error]="error()" [pending]="busy()" />
    <div class="stack">
      <div>
        <h1>School profile</h1>
        <p class="muted">What parents see in the app, and where they pay.</p>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      <section class="card badge-card">
        <div class="badge-preview">
          @if (staff.currentSchool()?.badge_url; as url) {
            <img [src]="url" alt="School badge" />
          } @else {
            <div class="badge-empty">No badge yet</div>
          }
        </div>
        <div class="stack">
          <h2>School badge</h2>
          <p class="muted small">Shown next to your school's name in the parent app. A square PNG or JPG up to 2 MB works best.</p>
          <div class="row">
            <button class="btn btn-outline" type="button" (click)="pickBadge()" [disabled]="busy()">{{ staff.currentSchool()?.badge_url ? 'Replace badge' : 'Upload badge' }}</button>
            <input #badgeInput type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="onBadgeChosen($event)" />
          </div>
        </div>
      </section>

      @let s = school();
      <form class="card stack" (ngSubmit)="saveSchool()">
        <h2>About the school</h2>
        <div class="form-grid">
          <div class="field wide"><label for="name">School name</label><input id="name" type="text" [(ngModel)]="s.name" name="name" required /></div>
          <div class="field wide"><label for="tagline">Tagline</label><input id="tagline" type="text" [(ngModel)]="s.tagline" name="tagline" placeholder="One line parents see under your name" /></div>
          <div class="field wide"><label for="description">Description</label><textarea id="description" [(ngModel)]="s.description" name="description"></textarea></div>
          <div class="field"><label for="lowest">Lowest grade</label>
            <select id="lowest" [(ngModel)]="s.lowest_grade" name="lowest">
              @for (g of grades(); track g.code) { <option [value]="g.code">{{ g.label }}</option> }
            </select>
          </div>
          <div class="field"><label for="highest">Highest grade</label>
            <select id="highest" [(ngModel)]="s.highest_grade" name="highest">
              @for (g of grades(); track g.code) { <option [value]="g.code">{{ g.label }}</option> }
            </select>
          </div>
          <div class="field wide"><label for="street">Street address</label><input id="street" type="text" [(ngModel)]="s.street_address" name="street" /></div>
          <div class="field"><label for="town">Town or suburb</label><input id="town" type="text" [(ngModel)]="s.town" name="town" required /></div>
          <div class="field"><label for="province">Province</label>
            <select id="province" [(ngModel)]="s.province" name="province">
              @for (p of provinces; track p) { <option [value]="p">{{ p }}</option> }
            </select>
          </div>
          <div class="field"><label for="phone">Phone</label><input id="phone" type="tel" [(ngModel)]="s.phone" name="phone" /></div>
          <div class="field"><label for="phone2">Second phone</label><input id="phone2" type="tel" [(ngModel)]="s.secondary_phone" name="phone2" /></div>
          <div class="field"><label for="email">Email</label><input id="email" type="email" [(ngModel)]="s.email" name="email" /></div>
          <div class="field wide"><label for="website">Website</label><input id="website" type="url" [(ngModel)]="s.website" name="website" placeholder="https://" /></div>
        </div>
        <h3>Legal details</h3>
        <p class="muted small">Not shown to parents. Used on receipts and official correspondence.</p>
        <div class="form-grid">
          <div class="field wide"><label for="legal">Registered legal name</label><input id="legal" type="text" [(ngModel)]="s.legal_name" name="legal" placeholder="e.g. Newborn Christian Academy (Pty) Ltd" /></div>
          <div class="field"><label for="coreg">Company registration</label><input id="coreg" type="text" [(ngModel)]="s.company_registration" name="coreg" /></div>
          <div class="field"><label for="npo">NPO registration</label><input id="npo" type="text" [(ngModel)]="s.npo_registration" name="npo" /></div>
          <div class="field"><label for="tax">Taxpayer reference</label><input id="tax" type="text" [(ngModel)]="s.tax_reference" name="tax" /></div>
        </div>
        <div><button class="btn btn-primary" type="submit" [disabled]="busy()">Save profile</button></div>
      </form>

      @let b = bank();
      <form class="card stack" (ngSubmit)="saveBank()">
        <h2>Bank account for enrolment fees</h2>
        <p class="muted small">Shown to parents on the payment screen together with their unique reference. Money goes straight to this account; Skoolo never holds it.</p>
        <div class="form-grid">
          <div class="field wide"><label for="holder">Account holder</label><input id="holder" type="text" [(ngModel)]="b.account_holder" name="holder" required /></div>
          <div class="field"><label for="bankName">Bank</label><input id="bankName" type="text" [(ngModel)]="b.bank_name" name="bankName" required /></div>
          <div class="field"><label for="type">Account type</label>
            <select id="type" [(ngModel)]="b.account_type" name="type">
              <option>Cheque</option><option>Savings</option><option>Transmission</option><option>Business</option>
            </select>
          </div>
          <div class="field"><label for="number">Account number</label><input id="number" type="text" inputmode="numeric" [(ngModel)]="b.account_number" name="number" required /></div>
          <div class="field"><label for="branch">Branch code</label><input id="branch" type="text" inputmode="numeric" [(ngModel)]="b.branch_code" name="branch" required /></div>
        </div>
        <div><button class="btn btn-primary" type="submit" [disabled]="busy()">Save bank details</button></div>
      </form>
    </div>
  `,
})
export class SchoolProfilePage {
  protected readonly staff = inject(StaffService);
  private readonly badgeInput = viewChild.required<ElementRef<HTMLInputElement>>('badgeInput');
  private readonly directory = inject(SchoolDirectoryService);

  protected readonly provinces = PROVINCES;
  protected readonly grades = signal<Grade[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  // Plain objects behind signals: ngModel mutates the properties, and replacing the object
  // after loading is what triggers a render in zoneless mode.
  protected readonly school = signal<SchoolForm>({
    name: '', tagline: '', description: '', lowest_grade: 'G00', highest_grade: 'G7',
    street_address: '', town: '', province: '', phone: '', secondary_phone: '', email: '', website: '', badge_url: '',
    legal_name: '', company_registration: '', npo_registration: '', tax_reference: '',
  });
  protected readonly bank = signal<BankForm>({
    account_holder: '', bank_name: '', account_type: 'Cheque', account_number: '', branch_code: '',
  });

  constructor() {
    void this.load();
  }

  protected pickBadge(): void {
    const input = this.badgeInput().nativeElement;
    input.value = '';
    input.click();
  }

  protected async onBadgeChosen(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.error.set('That image is larger than 2 MB. Please use a smaller one.');
      return;
    }
    await this.run(async () => {
      await this.staff.uploadBadge(file);
      this.notice.set('Badge uploaded. Parents will see it in the app.');
    });
  }

  protected async saveSchool(): Promise<void> {
    const s = this.school();
    await this.run(async () => {
      await this.staff.updateSchool({
        name: s.name.trim(),
        tagline: s.tagline.trim() || null,
        description: s.description.trim() || null,
        lowest_grade: s.lowest_grade || null,
        highest_grade: s.highest_grade || null,
        street_address: s.street_address.trim() || null,
        town: s.town.trim(),
        province: s.province || null,
        phone: s.phone.trim() || null,
        secondary_phone: s.secondary_phone.trim() || null,
        legal_name: s.legal_name.trim() || null,
        company_registration: s.company_registration.trim() || null,
        npo_registration: s.npo_registration.trim() || null,
        tax_reference: s.tax_reference.trim() || null,
        email: s.email.trim() || null,
        website: s.website.trim() || null,
        badge_url: s.badge_url.trim() || null,
      });
      this.notice.set('Profile saved.');
    });
  }

  protected async saveBank(): Promise<void> {
    const b = this.bank();
    await this.run(async () => {
      await this.staff.saveBankAccount({
        account_holder: b.account_holder.trim(),
        bank_name: b.bank_name.trim(),
        account_type: b.account_type,
        account_number: b.account_number.replace(/\s+/g, ''),
        branch_code: b.branch_code.replace(/\s+/g, ''),
      });
      this.notice.set('Bank details saved.');
    });
  }

  private async load(): Promise<void> {
    this.grades.set(await this.directory.grades());
    const s = this.staff.currentSchool();
    if (s) {
      this.school.set({
        name: s.name, tagline: s.tagline ?? '', description: s.description ?? '',
        lowest_grade: s.lowest_grade ?? 'G00', highest_grade: s.highest_grade ?? 'G7',
        street_address: s.street_address ?? '', town: s.town, province: s.province ?? '',
        phone: s.phone ?? '', secondary_phone: s.secondary_phone ?? '', email: s.email ?? '', website: s.website ?? '', badge_url: s.badge_url ?? '',
        legal_name: s.legal_name ?? '', company_registration: s.company_registration ?? '', npo_registration: s.npo_registration ?? '',
        tax_reference: s.tax_reference ?? '',
      });
    }
    const b = await this.staff.bankAccount();
    if (b) {
      this.bank.set({
        account_holder: b.account_holder, bank_name: b.bank_name, account_type: b.account_type,
        account_number: b.account_number, branch_code: b.branch_code,
      });
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }
}
