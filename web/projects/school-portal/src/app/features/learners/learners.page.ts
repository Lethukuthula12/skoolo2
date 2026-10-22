import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import {
  ClassRow, Learner, LearnerGuardian, LearnerInsert, RegisterLearnerRow, SchoolDirectoryService,
  StaffService, isValidSaIdentityNumber,
} from '@skoolo/shared';

interface LearnerForm {
  id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'female' | 'male' | 'unspecified';
  identity_type: 'sa_id' | 'passport' | 'none';
  identity_number: string;
  passport_number: string;
  admission_number: string;
  home_language: string;
  guardian_name: string;
  guardian_phone: string;
}

interface ImportRow {
  data: LearnerInsert;
  guardian: { full_name: string; phone: string } | null;
  error: string | null;
  label: string;
}

const EMPTY: LearnerForm = {
  id: null, first_name: '', last_name: '', date_of_birth: '', gender: 'unspecified',
  identity_type: 'sa_id', identity_number: '', passport_number: '', admission_number: '',
  home_language: '', guardian_name: '', guardian_phone: '',
};

@Component({
  selector: 'app-learners-page',
  imports: [FormsModule],
  templateUrl: './learners.page.html',
  styleUrl: './learners.page.scss',
})
export class LearnersPage {
  private readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly classes = signal<ClassRow[]>([]);
  protected readonly allLearners = signal<RegisterLearnerRow[]>([]);
  protected readonly selectedClassId = signal<string>('');
  protected readonly year = signal(new Date().getFullYear() + 1);

  protected readonly editing = signal(false);
  protected readonly form = signal<LearnerForm>({ ...EMPTY });
  protected readonly guardians = signal<LearnerGuardian[]>([]);

  protected readonly importRows = signal<ImportRow[]>([]);
  protected readonly showImport = signal(false);

  protected readonly roster = computed(() => {
    const classId = this.selectedClassId();
    return this.allLearners()
      .filter((l) => (classId ? l.current_class_id === classId : !l.current_class_id))
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  });

  protected readonly selectedClass = computed(() => this.classes().find((c) => c.id === this.selectedClassId()) ?? null);
  protected readonly validImportCount = computed(() => this.importRows().filter((r) => !r.error).length);

  constructor() {
    void this.load();
  }

  protected gradeLabelOf(c: ClassRow): string {
    return c.grades?.label ?? c.grade_code;
  }

  protected age(dob: string): number {
    const d = new Date(dob);
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
    return a;
  }

  // ----- add / edit -----

  protected startNew(): void {
    this.form.set({ ...EMPTY });
    this.guardians.set([]);
    this.editing.set(true);
  }

  protected async edit(learner: RegisterLearnerRow): Promise<void> {
    this.form.set({
      id: learner.id,
      first_name: learner.first_name,
      last_name: learner.last_name,
      date_of_birth: learner.date_of_birth,
      gender: learner.gender,
      identity_type: learner.identity_number ? 'sa_id' : learner.passport_number ? 'passport' : 'none',
      identity_number: learner.identity_number ?? '',
      passport_number: learner.passport_number ?? '',
      admission_number: learner.admission_number ?? '',
      home_language: learner.home_language ?? '',
      guardian_name: '', guardian_phone: '',
    });
    this.editing.set(true);
    this.guardians.set(await this.staff.guardians(learner.id));
  }

  protected cancel(): void {
    this.editing.set(false);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    const id = f.identity_number.trim();
    if (f.identity_type === 'sa_id' && id && !isValidSaIdentityNumber(id)) {
      this.error.set('That ID number is not valid. Please check it.');
      return;
    }
    await this.run(async () => {
      const saved = await this.staff.saveLearner({
        ...(f.id ? { id: f.id } : {}),
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        date_of_birth: f.date_of_birth,
        gender: f.gender,
        identity_number: f.identity_type === 'sa_id' ? id || null : null,
        passport_number: f.identity_type === 'passport' ? f.passport_number.trim() || null : null,
        admission_number: f.admission_number.trim() || null,
        home_language: f.home_language.trim() || null,
        current_class_id: this.selectedClassId() || null,
      });
      // A primary guardian typed on a new learner is created now.
      if (!f.id && f.guardian_name.trim()) {
        await this.staff.saveGuardian({ learner_id: saved.id, full_name: f.guardian_name.trim(), phone: f.guardian_phone.trim(), is_primary: true });
      }
      this.form.update((c) => ({ ...c, id: saved.id, guardian_name: '', guardian_phone: '' }));
      this.guardians.set(await this.staff.guardians(saved.id));
      this.notice.set(`${saved.first_name} ${saved.last_name} saved.`);
      await this.loadLearners();
    }, 'Could not save the learner. An admission number must be unique, and an ID number must be valid.');
  }

  protected async addGuardian(): Promise<void> {
    const f = this.form();
    if (!f.id || !f.guardian_name.trim()) return;
    await this.run(async () => {
      await this.staff.saveGuardian({
        learner_id: f.id!, full_name: f.guardian_name.trim(), phone: f.guardian_phone.trim(),
        is_primary: this.guardians().length === 0,
      });
      this.form.update((c) => ({ ...c, guardian_name: '', guardian_phone: '' }));
      this.guardians.set(await this.staff.guardians(f.id!));
      this.notice.set('Guardian added.');
    });
  }

  protected async removeGuardian(g: LearnerGuardian): Promise<void> {
    await this.run(async () => {
      await this.staff.deleteGuardian(g.id);
      this.guardians.set(await this.staff.guardians(g.learner_id));
    });
  }

  protected async remove(learner: RegisterLearnerRow): Promise<void> {
    if (!confirm(`Remove ${learner.first_name} ${learner.last_name} from the register?`)) return;
    await this.run(async () => {
      await this.staff.deleteLearner(learner.id);
      this.editing.set(false);
      this.notice.set('Learner removed.');
      await this.loadLearners();
    });
  }

  protected async removeCurrent(): Promise<void> {
    const f = this.form();
    if (!f.id) return;
    if (!confirm(`Remove ${f.first_name} ${f.last_name} from the register?`)) return;
    await this.run(async () => {
      await this.staff.deleteLearner(f.id!);
      this.editing.set(false);
      this.notice.set('Learner removed.');
      await this.loadLearners();
    });
  }

  protected async moveLearner(learner: RegisterLearnerRow, classId: string): Promise<void> {
    await this.run(async () => {
      await this.staff.moveLearner(learner.id, classId || null);
      await this.loadLearners();
      this.notice.set('Learner moved.');
    });
  }

  // ----- import -----

  protected pickFile(): void {
    if (!this.selectedClassId()) {
      this.error.set('Choose a class first, then import learners into it.');
      return;
    }
    const input = this.fileInput().nativeElement;
    input.value = '';
    input.click();
  }

  protected async onFileChosen(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.error.set(null);
    try {
      let rows: Record<string, unknown>[];
      if (file.name.toLowerCase().endsWith('.csv')) {
        // Parse CSV ourselves so dates stay as text and are read day-first, not US month-first.
        rows = this.parseCsv(await file.text());
      } else {
        const buffer = await file.arrayBuffer();
        const book = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheet = book.Sheets[book.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: '' });
      }
      this.importRows.set(rows.map((r, i) => this.parseImportRow(r, i)));
      this.showImport.set(true);
    } catch (err) {
      console.error(err);
      this.error.set('Could not read that file. Save it as .xlsx or .csv and try again.');
    }
  }

  private parseCsv(text: string): Record<string, string>[] {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const split = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map((c) => c.trim());
    };
    const headers = split(lines[0]);
    return lines.slice(1).map((line) => {
      const cells = split(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
      return row;
    });
  }

  private parseImportRow(row: Record<string, unknown>, index: number): ImportRow {
    const get = (...keys: string[]): string => {
      for (const key of Object.keys(row)) {
        const norm = key.toLowerCase().replace(/[^a-z]/g, '');
        if (keys.some((k) => norm === k || norm.includes(k))) {
          const v = row[key];
          if (v instanceof Date) {
            return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
          }
          return String(v ?? '').trim();
        }
      }
      return '';
    };
    const first = get('firstname', 'name', 'learnername');
    const last = get('surname', 'lastname', 'familyname');
    const dobRaw = get('dateofbirth', 'dob', 'birth');
    const dob = this.normaliseDate(dobRaw);
    const idNo = get('idnumber', 'identity', 'id').replace(/\s/g, '');
    const passport = get('passport');
    const genderRaw = get('gender', 'sex').toLowerCase();
    const admission = get('admissionnumber', 'admission');
    const guardianName = get('guardian', 'parent', 'contactname', 'mother', 'father');
    const guardianPhone = get('phone', 'cell', 'contactnumber', 'contact', 'mobile').replace(/\s/g, '');

    const label = `Row ${index + 2}: ${first} ${last}`.trim();
    let error: string | null = null;
    if (!first || !last) error = 'Missing first name or surname';
    else if (!dob) error = 'Missing or unreadable date of birth';
    else if (idNo && passport) error = 'Has both an ID and a passport';
    else if (idNo && !isValidSaIdentityNumber(idNo)) error = 'ID number is not valid';

    const gender: 'female' | 'male' | 'unspecified' =
      genderRaw.startsWith('f') ? 'female' : genderRaw.startsWith('m') ? 'male' : 'unspecified';

    return {
      label,
      error,
      guardian: guardianName ? { full_name: guardianName, phone: guardianPhone } : null,
      data: {
        first_name: first, last_name: last, date_of_birth: dob, gender,
        identity_number: idNo || null, passport_number: idNo ? null : passport || null,
        admission_number: admission || null,
      } as LearnerInsert,
    };
  }

  private normaliseDate(value: string): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const dmy = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  }

  protected async confirmImport(): Promise<void> {
    const valid = this.importRows().filter((r) => !r.error);
    if (valid.length === 0) return;
    await this.run(async () => {
      await this.staff.importLearners(this.selectedClassId(), valid.map((r) => r.data));
      // Guardians: match back by name after reload (simple approach for the pilot).
      await this.loadLearners();
      const byName = new Map(this.roster().map((l) => [`${l.first_name}|${l.last_name}`.toLowerCase(), l.id]));
      for (const r of valid) {
        if (r.guardian) {
          const id = byName.get(`${r.data.first_name}|${r.data.last_name}`.toLowerCase());
          if (id) await this.staff.saveGuardian({ learner_id: id, full_name: r.guardian.full_name, phone: r.guardian.phone, is_primary: true });
        }
      }
      this.showImport.set(false);
      this.importRows.set([]);
      this.notice.set(`Imported ${valid.length} learners.`);
    }, 'Import failed. Some rows may clash with existing learners.');
  }

  protected cancelImport(): void {
    this.showImport.set(false);
    this.importRows.set([]);
  }

  // ----- export / print -----

  protected exportRoster(): void {
    const cls = this.selectedClass();
    const rows = this.roster().map((l, i) => ({
      '#': i + 1,
      Surname: l.last_name,
      'First name': l.first_name,
      'Date of birth': l.date_of_birth,
      Age: this.age(l.date_of_birth),
      Gender: l.gender,
      'ID / passport': l.identity_number || l.passport_number || '',
      'Admission no.': l.admission_number || '',
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Class list');
    const name = cls ? `${this.gradeLabelOf(cls)} ${cls.name}` : 'Unassigned';
    XLSX.writeFile(book, `Class list - ${name} ${this.year()}.xlsx`);
  }

  protected printRoster(): void {
    const cls = this.selectedClass();
    const title = `${this.staff.currentSchool()?.name ?? ''} — ${cls ? this.gradeLabelOf(cls) + ' ' + cls.name : 'Unassigned'} (${this.year()})`;
    const body = this.roster()
      .map((l, i) => `<tr><td>${i + 1}</td><td>${l.last_name}</td><td>${l.first_name}</td><td>${l.date_of_birth}</td><td>${l.gender}</td><td>${l.identity_number || l.passport_number || ''}</td></tr>`)
      .join('');
    const html = `<!doctype html><html><head><title>${title}</title><style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#14213d}
      h1{font-size:18px} table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px}
      th{background:#f0f0f0}</style></head><body>
      <h1>${title}</h1>
      <table><thead><tr><th>#</th><th>Surname</th><th>First name</th><th>Date of birth</th><th>Gender</th><th>ID / passport</th></tr></thead>
      <tbody>${body}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }

  // ----- loading -----

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.classes.set(await this.staff.classes(this.year()));
      if (!this.selectedClassId() && this.classes().length > 0) {
        this.selectedClassId.set(this.classes()[0].id);
      }
      await this.loadLearners();
    } catch (err) {
      console.error(err);
      this.error.set('Could not load the learner register.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadLearners(): Promise<void> {
    this.allLearners.set(await this.staff.schoolLearners());
  }

  private async run(action: () => Promise<void>, failure = 'Something went wrong.'): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (err) {
      console.error(err);
      this.error.set(failure);
    } finally {
      this.busy.set(false);
    }
  }
}
