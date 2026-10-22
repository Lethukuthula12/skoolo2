import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { STAFF_POSITIONS, StaffMember, StaffService, isValidSaIdentityNumber } from '@skoolo/shared';

interface StaffForm {
  id: string | null;
  first_name: string;
  last_name: string;
  position: string;
  class_assigned: string;
  identity_number: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: StaffForm = {
  id: null, first_name: '', last_name: '', position: 'Teacher', class_assigned: '', identity_number: '',
  phone: '', email: '', address: '', notes: '',
};

@Component({
  selector: 'app-staff-register-page',
  imports: [FormsModule],
  template: `
    <div class="stack">
      <div class="toolbar">
        <div>
          <h1>Staff register</h1>
          <p class="muted">Everyone who works at {{ staff.currentSchool()?.name }}, with or without a Skoolo login.</p>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-primary" type="button" (click)="startNew()">Add staff member</button>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      @if (editing()) {
        @let f = form();
        <form class="card stack" (ngSubmit)="save()">
          <h2>{{ f.id ? 'Edit staff member' : 'New staff member' }}</h2>
          <div class="form-grid">
            <div class="field"><label for="first">First name</label><input id="first" type="text" [(ngModel)]="f.first_name" name="first" required /></div>
            <div class="field"><label for="last">Surname</label><input id="last" type="text" [(ngModel)]="f.last_name" name="last" required /></div>
            <div class="field"><label for="position">Position</label>
              <select id="position" [(ngModel)]="f.position" name="position">
                @for (p of positions; track p) { <option [value]="p">{{ p }}</option> }
              </select>
            </div>
            <div class="field"><label for="class">Class assigned</label><input id="class" type="text" [(ngModel)]="f.class_assigned" name="class" placeholder="e.g. Grade 3" /></div>
            <div class="field"><label for="idno">ID number</label><input id="idno" type="text" inputmode="numeric" [(ngModel)]="f.identity_number" name="idno" maxlength="13" /></div>
            <div class="field"><label for="phone">Phone</label><input id="phone" type="tel" [(ngModel)]="f.phone" name="phone" /></div>
            <div class="field"><label for="email">Email</label><input id="email" type="email" [(ngModel)]="f.email" name="email" /></div>
            <div class="field wide"><label for="address">Address</label><input id="address" type="text" [(ngModel)]="f.address" name="address" /></div>
            <div class="field wide"><label for="notes">Notes</label><textarea id="notes" [(ngModel)]="f.notes" name="notes" placeholder="Qualifications, start date, anything else useful"></textarea></div>
          </div>
          @if (idWarning()) { <p class="error">{{ idWarning() }}</p> }
          <div class="row">
            <button class="btn btn-primary" type="submit" [disabled]="busy() || !f.first_name.trim() || !f.last_name.trim()">Save</button>
            <button class="btn btn-outline" type="button" (click)="cancel()" [disabled]="busy()">Cancel</button>
            @if (f.id) {
              <span class="spacer"></span>
              <button class="btn btn-danger" type="button" (click)="remove(f.id)" [disabled]="busy()">Remove</button>
            }
          </div>
        </form>
      }

      <div class="card stack">
        <div class="toolbar">
          <input type="text" class="search" placeholder="Search by name, position or class" [ngModel]="search()" (ngModelChange)="search.set($event)" />
          <span class="muted small">{{ filtered().length }} of {{ members().length }}</span>
        </div>
        @if (loading()) {
          <p class="muted">Loading…</p>
        } @else if (members().length === 0) {
          <div class="empty">No staff recorded yet. Add the principal, admin clerk and teachers to start.</div>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Name</th><th>Position</th><th>Class</th><th>ID number</th><th>Phone</th><th>Email</th></tr></thead>
              <tbody>
                @for (m of filtered(); track m.id) {
                  <tr class="clickable" (click)="edit(m)">
                    <td><strong>{{ m.last_name }}, {{ m.first_name }}</strong></td>
                    <td>{{ m.position }}</td>
                    <td>{{ m.class_assigned }}</td>
                    <td>{{ m.identity_number }}</td>
                    <td>{{ m.phone }}</td>
                    <td>{{ m.email }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .search { max-width: 320px; }
  `,
})
export class StaffRegisterPage {
  protected readonly staff = inject(StaffService);

  protected readonly positions = STAFF_POSITIONS;
  protected readonly members = signal<StaffMember[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly editing = signal(false);
  protected readonly form = signal<StaffForm>({ ...EMPTY_FORM });
  protected readonly idWarning = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.members();
    return this.members().filter((m) =>
      [m.first_name, m.last_name, m.position, m.class_assigned ?? '', m.phone ?? '', m.email ?? '']
        .join(' ').toLowerCase().includes(term),
    );
  });

  constructor() {
    void this.load();
  }

  protected startNew(): void {
    this.form.set({ ...EMPTY_FORM });
    this.idWarning.set(null);
    this.editing.set(true);
  }

  protected edit(member: StaffMember): void {
    this.form.set({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      position: member.position,
      class_assigned: member.class_assigned ?? '',
      identity_number: member.identity_number ?? '',
      phone: member.phone ?? '',
      email: member.email ?? '',
      address: member.address ?? '',
      notes: member.notes ?? '',
    });
    this.idWarning.set(null);
    this.editing.set(true);
  }

  protected cancel(): void {
    this.editing.set(false);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    const idNumber = f.identity_number.trim();
    if (idNumber && /^\d{13}$/.test(idNumber) && !isValidSaIdentityNumber(idNumber)) {
      this.idWarning.set('That ID number does not pass the checksum. Please check it.');
      return;
    }
    this.idWarning.set(null);
    await this.run(async () => {
      await this.staff.saveStaffMember({
        ...(f.id ? { id: f.id } : {}),
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        position: f.position,
        class_assigned: f.class_assigned.trim() || null,
        identity_number: idNumber || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        address: f.address.trim() || null,
        notes: f.notes.trim() || null,
      });
      this.editing.set(false);
      this.notice.set(`${f.first_name.trim()} ${f.last_name.trim()} saved.`);
    });
  }

  protected async remove(id: string): Promise<void> {
    if (!confirm('Remove this staff member from the register?')) return;
    await this.run(async () => {
      await this.staff.deleteStaffMember(id);
      this.editing.set(false);
      this.notice.set('Removed.');
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.members.set(await this.staff.staffMembers());
    } catch (err) {
      console.error(err);
      this.error.set('Could not load the staff register.');
    } finally {
      this.loading.set(false);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
      await this.load();
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }
}
