import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TablePagination } from '../../ui/table-pagination';
import { TablePaginationComponent } from '../../ui/table-pagination.component';
import { ActionFeedbackComponent, STAFF_DOCUMENT_TYPES, STAFF_POSITIONS, SchoolStaffRow, StaffDocument, StaffInvite, StaffMember, StaffRole,
  StaffService, isValidSaIdentityNumber, } from '@skoolo/shared';

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
  imports: [ActionFeedbackComponent, DatePipe, FormsModule, TablePaginationComponent],
  template: `
    <skoolo-action-feedback [success]="notice()" [error]="error()" [pending]="busy()" />
    <div class="stack">
      <div class="toolbar">
        <div>
          <h1>Staff register</h1>
          <p class="muted">Everyone who works at {{ staff.currentSchool()?.name }}. Invite the ones who need to sign in.</p>
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

          @if (f.id) {
            <hr />
            <div class="grid-2">
              <section class="stack">
                <h3>Documents</h3>
                <p class="muted small">ID copy, qualifications, contract, police clearance. Only administrators can see these.</p>
                @if (documents().length > 0) {
                  <div class="table-wrap"><table class="data">
                    <tbody>
                      @for (d of documents(); track d.id) {
                        <tr>
                          <td><strong>{{ d.document_type }}</strong><br /><span class="muted small">{{ d.file_name }} · {{ d.created_at | date: 'd MMM yyyy' }}</span></td>
                          <td class="right">
                            <button class="btn btn-outline btn-sm" type="button" (click)="openDocument(d)">Open</button>
                            <button class="btn btn-ghost btn-sm" type="button" (click)="deleteDocument(d)">Delete</button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table></div>
                } @else {
                  <p class="muted small">No documents yet.</p>
                }
                <div class="row">
                  <select [(ngModel)]="documentType" name="documentType">
                    @for (t of documentTypes; track t) { <option [value]="t">{{ t }}</option> }
                  </select>
                  <button class="btn btn-outline btn-sm" type="button" (click)="pickDocument()" [disabled]="busy()">Upload file</button>
                </div>
                <input #fileInput type="file" accept="image/*,application/pdf" hidden (change)="onDocumentChosen($event)" />
              </section>

              <section class="stack">
                <h3>Portal sign-in</h3>
                @if (memberLogin(); as login) {
                  <p class="small">Signed in as <strong>{{ login.profile?.email }}</strong> ({{ login.role === 'admin' ? 'administrator' : 'staff' }}).</p>
                } @else if (memberInvite(); as invite) {
                  <p class="small">Invite code for <strong>{{ invite.email }}</strong>, valid until {{ invite.expires_at | date: 'd MMM yyyy' }}:</p>
                  <div class="code-box">
                    <code>{{ invite.code }}</code>
                    <button class="btn btn-outline btn-sm" type="button" (click)="copy(inviteLink(invite))">Copy link</button>
                    <a class="btn btn-outline btn-sm" [href]="whatsappLink(invite)" target="_blank" rel="noopener">WhatsApp</a>
                    <button class="btn btn-ghost btn-sm" type="button" (click)="cancelInvite(invite)">Cancel</button>
                  </div>
                } @else {
                  <p class="muted small">Give this person a login so they can use the portal. They sign up with the email below and enter the code.</p>
                  <div class="row">
                    <select [(ngModel)]="inviteRole" name="inviteRole">
                      <option value="staff">Staff (view applications)</option>
                      <option value="admin">Administrator (full access)</option>
                    </select>
                    <button class="btn btn-primary btn-sm" type="button" (click)="invite()" [disabled]="busy() || !f.email.trim()">Create invite</button>
                  </div>
                  @if (!f.email.trim()) { <p class="muted small">Add an email address above first.</p> }
                }
              </section>
            </div>
          }
        </form>
      }

      <div class="card stack">
        <div class="table-tools">
          <label class="search-field">Search staff<input type="search" placeholder="Name, position or class" [ngModel]="search()" (ngModelChange)="search.set($event)" /></label>
          <label>Sort by<select [ngModel]="sort()" (ngModelChange)="sort.set($event)"><option value="name">Surname A–Z</option><option value="name-desc">Surname Z–A</option><option value="position">Position</option></select></label>
        </div>
        @if (loading()) {
          <div class="loading-state" role="status"><span class="sr-only">Loading school information…</span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span></div>
        } @else if (members().length === 0) {
          <div class="empty"><p>No staff recorded yet. Add the principal, admin clerk and teachers to start.</p><button class="btn btn-primary" type="button" (click)="startNew()">Add staff member</button></div>
        } @else if (filtered().length === 0) {
          <div class="empty"><p>No staff match your search.</p><button class="btn btn-outline" type="button" (click)="search.set('')">Clear search</button></div>
        } @else {
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Name</th><th>Position</th><th>Class</th><th>Phone</th><th>Email</th><th>Sign-in</th></tr></thead>
              <tbody>
                @for (m of pagination.visible(); track m.id) {
                  <tr>
                    <td><div class="person-cell"><span class="person-avatar" aria-hidden="true">{{ m.first_name.charAt(0) }}{{ m.last_name.charAt(0) }}</span><button class="table-link" type="button" (click)="edit(m)">{{ m.last_name }}, {{ m.first_name }}</button></div></td>
                    <td>{{ m.position }}</td>
                    <td>{{ m.class_assigned }}</td>
                    <td>{{ m.phone }}</td>
                    <td>{{ m.email }}</td>
                    <td>
                      @if (m.user_id) { <span class="badge badge-success">Active</span> }
                      @else if (pendingInviteFor(m.id)) { <span class="badge badge-warning">Invited</span> }
                      @else { <span class="muted small">—</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (!loading()) { <app-table-pagination [pagination]="pagination" /> }
      </div>

      <div class="card stack">
        <h2>Who can sign in</h2>
        <p class="muted small">Logins linked to this school. Administrators can change everything; staff can view applications.</p>
        @if (logins().length === 0) {
          <p class="muted">No logins yet.</p>
        } @else {
          <div class="table-wrap"><table class="data">
            <tbody>
              @for (l of logins(); track l.user_id) {
                <tr>
                  <td><strong>{{ l.profile?.full_name || l.profile?.email }}</strong><br /><span class="muted small">{{ l.profile?.email }} · {{ l.profile?.phone }}</span></td>
                  <td><span class="badge" [class.badge-muted]="l.role !== 'admin'">{{ l.role === 'admin' ? 'Administrator' : 'Staff' }}</span></td>
                  <td class="right">
                    @if (l.user_id !== currentUserId()) {
                      <button class="btn btn-ghost btn-sm" type="button" (click)="removeLogin(l)">Remove access</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table></div>
        }
        @if (openInvites().length > 0) {
          <h3>Open invites</h3>
          <div class="table-wrap"><table class="data">
            <tbody>
              @for (i of openInvites(); track i.id) {
                <tr>
                  <td>{{ i.full_name || i.email }}<br /><span class="muted small">{{ i.email }} · {{ i.role === 'admin' ? 'Administrator' : 'Staff' }} · expires {{ i.expires_at | date: 'd MMM' }}</span></td>
                  <td><code>{{ i.code }}</code></td>
                  <td class="right">
                    <button class="btn btn-outline btn-sm" type="button" (click)="copy(inviteLink(i))">Copy link</button>
                    <button class="btn btn-ghost btn-sm" type="button" (click)="cancelInvite(i)">Cancel</button>
                  </td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      </div>
    </div>
  `,
  styles: `
    .right { text-align: right; white-space: nowrap; }
    hr { border: none; border-top: 1px solid var(--line); margin: 4px 0; }
    .code-box { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .code-box code { font-size: 1.2rem; letter-spacing: 0.12em; background: var(--brand-soft); padding: 6px 10px; border-radius: 8px; }
    select { width: auto; }
  `,
})
export class StaffRegisterPage {
  protected readonly staff = inject(StaffService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly positions = STAFF_POSITIONS;
  protected readonly documentTypes = STAFF_DOCUMENT_TYPES;
  protected readonly members = signal<StaffMember[]>([]);
  protected readonly logins = signal<SchoolStaffRow[]>([]);
  protected readonly invites = signal<StaffInvite[]>([]);
  protected readonly documents = signal<StaffDocument[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly sort = signal('name');
  protected readonly editing = signal(false);
  protected readonly form = signal<StaffForm>({ ...EMPTY_FORM });
  protected readonly idWarning = signal<string | null>(null);
  protected readonly currentUserId = signal<string | null>(null);

  protected documentType = 'ID copy';
  protected inviteRole: StaffRole = 'staff';

  protected readonly openInvites = computed(() => this.invites().filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date()));
  protected readonly memberInvite = computed(() => this.pendingInviteFor(this.form().id));
  protected readonly memberLogin = computed(() => {
    const member = this.members().find((m) => m.id === this.form().id);
    return member?.user_id ? this.logins().find((l) => l.user_id === member.user_id) ?? null : null;
  });

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.members();
    return this.members().filter((m) =>
      [m.first_name, m.last_name, m.position, m.class_assigned ?? '', m.phone ?? '', m.email ?? '']
        .join(' ').toLowerCase().includes(term),
    );
  });
  protected readonly sorted = computed(() => [...this.filtered()].sort((a, b) => {
    const name = a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
    if (this.sort() === 'position') return a.position.localeCompare(b.position) || name;
    return this.sort() === 'name-desc' ? -name : name;
  }));
  protected readonly pagination = new TablePagination(this.sorted, computed(() => [this.search(), this.sort()]));

  constructor() {
    void this.load();
  }

  protected pendingInviteFor(memberId: string | null): StaffInvite | null {
    if (!memberId) return null;
    return this.openInvites().find((i) => i.staff_member_id === memberId) ?? null;
  }

  protected inviteLink(invite: StaffInvite): string {
    return `${location.origin}/join?code=${invite.code}`;
  }

  protected whatsappLink(invite: StaffInvite): string {
    const school = this.staff.currentSchool()?.name ?? 'our school';
    const text = `Hi ${invite.full_name || ''}, here is your Skoolo login invite for ${school}. Open ${this.inviteLink(invite)} and sign up with ${invite.email}. Your code is ${invite.code}.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.notice.set('Copied.');
    } catch {
      this.error.set('Could not copy. Select the code and copy it by hand.');
    }
  }

  protected startNew(): void {
    this.form.set({ ...EMPTY_FORM });
    this.documents.set([]);
    this.idWarning.set(null);
    this.editing.set(true);
  }

  protected async edit(member: StaffMember): Promise<void> {
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
    this.documents.set(await this.staff.staffDocuments(member.id));
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
      const saved = await this.staff.saveStaffMember({
        ...(f.id ? { id: f.id } : {}),
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        position: f.position,
        class_assigned: f.class_assigned.trim() || null,
        identity_number: idNumber || null,
        phone: f.phone.trim() || null,
        email: f.email.trim().toLowerCase() || null,
        address: f.address.trim() || null,
        notes: f.notes.trim() || null,
      });
      // Stay on the record after a first save so documents and an invite can be added.
      this.form.update((current) => ({ ...current, id: saved.id, email: saved.email ?? '' }));
      this.notice.set(`${saved.first_name} ${saved.last_name} saved.`);
    });
  }

  protected async remove(id: string): Promise<void> {
    if (!confirm('Remove this staff member from the register? Their documents are removed too.')) return;
    await this.run(async () => {
      await this.staff.deleteStaffMember(id);
      this.editing.set(false);
      this.notice.set('Removed.');
    });
  }

  protected async invite(): Promise<void> {
    const f = this.form();
    if (!f.id || !f.email.trim()) return;
    await this.run(async () => {
      await this.staff.createInvite({
        email: f.email.trim().toLowerCase(),
        fullName: `${f.first_name} ${f.last_name}`.trim(),
        role: this.inviteRole,
        staffMemberId: f.id,
      });
      this.notice.set('Invite created. Share the code or link with them.');
    });
  }

  protected async cancelInvite(invite: StaffInvite): Promise<void> {
    await this.run(async () => {
      await this.staff.deleteInvite(invite.id);
      this.notice.set('Invite cancelled.');
    });
  }

  protected async removeLogin(login: SchoolStaffRow): Promise<void> {
    if (!confirm(`Remove portal access for ${login.profile?.full_name || login.profile?.email}?`)) return;
    await this.run(async () => {
      await this.staff.removeLogin(login.user_id);
      this.notice.set('Access removed.');
    });
  }

  protected pickDocument(): void {
    const input = this.fileInput().nativeElement;
    input.value = '';
    input.click();
  }

  protected async onDocumentChosen(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    const memberId = this.form().id;
    if (!file || !memberId) return;
    await this.run(async () => {
      await this.staff.uploadStaffDocument(memberId, this.documentType, file);
      this.documents.set(await this.staff.staffDocuments(memberId));
      this.notice.set('Document uploaded.');
    });
  }

  protected async openDocument(doc: StaffDocument): Promise<void> {
    try {
      window.open(await this.staff.staffDocumentUrl(doc.storage_path), '_blank', 'noopener');
    } catch (err) {
      console.error(err);
      this.error.set('Could not open that document.');
    }
  }

  protected async deleteDocument(doc: StaffDocument): Promise<void> {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    await this.run(async () => {
      await this.staff.deleteStaffDocument(doc);
      this.documents.set(await this.staff.staffDocuments(doc.staff_member_id));
      this.notice.set('Document deleted.');
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [members, logins, invites] = await Promise.all([
        this.staff.staffMembers(), this.staff.logins(), this.staff.invites(),
      ]);
      this.members.set(members);
      this.logins.set(logins);
      this.invites.set(invites);
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
