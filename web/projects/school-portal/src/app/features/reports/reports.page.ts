import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { escapePrintText as text, openPrintDocument, printImageUrl, PRINT_DOCUMENT_POLICY } from '../../ui/print-document';
import {
  ACHIEVEMENT_LEVELS, AcademicTerm, Grade, ReportCardFull, ReportMarkFull, SchoolDirectoryService,
  StaffService, achievementLevel,
} from '@skoolo/shared';

interface ClassOption { id: string; grade_code: string; name: string; academic_year: number; }

@Component({
  selector: 'app-reports-page',
  imports: [FormsModule],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
})
export class ReportsPage {
  protected readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);

  protected readonly levels = ACHIEVEMENT_LEVELS;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly grades = signal<Grade[]>([]);
  protected readonly classOptions = signal<ClassOption[]>([]);
  protected readonly reports = signal<ReportCardFull[]>([]);
  protected readonly term = signal(1);
  protected readonly year = signal(new Date().getFullYear() + 1);
  protected readonly selectedClassId = signal<string>('');
  protected readonly filterOutcome = signal<'all' | 'pass' | 'fail'>('all');

  protected readonly selectedClass = computed(() => this.classOptions().find((c) => c.id === this.selectedClassId()) ?? null);
  protected readonly isAdmin = computed(() => this.staff.isAdmin());

  /** Subject columns for the grid, from the first report (same grade subjects across the class). */
  protected readonly subjectColumns = computed(() => {
    const marks = this.reports()[0]?.report_marks ?? [];
    return [...marks].map((m) => m.subjects).filter((s): s is NonNullable<typeof s> => !!s)
      .sort((a, b) => a.sort_order - b.sort_order);
  });

  protected readonly anyDraft = computed(() => this.reports().some((r) => r.status === 'draft'));
  protected readonly anyApproved = computed(() => this.reports().some((r) => r.status === 'approved'));
  protected readonly allPublished = computed(() => this.reports().length > 0 && this.reports().every((r) => r.status === 'published'));

  constructor() {
    void this.load();
  }

  protected gradeSort(code: string): number {
    return this.grades().find((g) => g.code === code)?.sort_order ?? 0;
  }

  protected markFor(report: ReportCardFull, subjectId: string): number | null {
    return report.report_marks.find((m) => m.subjects?.id === subjectId)?.mark ?? null;
  }

  protected levelFor(mark: number | null): number | null {
    return achievementLevel(mark);
  }

  protected average(report: ReportCardFull): number | null {
    const marks = report.report_marks.map((m) => m.mark).filter((m): m is number => m !== null);
    if (marks.length === 0) return null;
    return Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 10) / 10;
  }

  /** CAPS promotion guideline per phase (docs/report-card-spec.md). Null when marks are incomplete. */
  protected meetsPromotion(report: ReportCardFull): boolean | null {
    const sort = this.gradeSort(this.selectedClass()?.grade_code ?? '');
    const find = (pred: (m: ReportMarkFull) => boolean) => report.report_marks.find(pred)?.mark ?? null;
    const home = find((m) => m.subjects?.language_level === 'home');
    const fal = find((m) => m.subjects?.language_level === 'first_additional');
    const maths = find((m) => (m.subjects?.name ?? '').toLowerCase().startsWith('math'));
    const others = report.report_marks
      .filter((m) => m.subjects && m.subjects.language_level == null && !(m.subjects.name ?? '').toLowerCase().startsWith('math'))
      .map((m) => m.mark);
    if (report.report_marks.some((m) => m.mark === null)) return null; // incomplete
    const ge = (v: number | null, t: number) => v !== null && v >= t;
    const countGe = (arr: (number | null)[], t: number) => arr.filter((v) => ge(v, t)).length;
    if (sort <= this.gradeSort('G3')) {
      // Foundation: home >=50, FAL >=40 (grades 1-3), maths >=40
      return ge(home, 50) && (fal === null || ge(fal, 40)) && ge(maths, 40);
    }
    if (sort <= this.gradeSort('G6')) {
      // Intermediate: home >=50, FAL >=40, maths >=40, and >=40 in any two others
      return ge(home, 50) && ge(fal, 40) && ge(maths, 40) && countGe(others, 40) >= 2;
    }
    // Senior: home >=50, FAL >=40, maths >=40, >=40 in any three others, >=30 in any two others
    return ge(home, 50) && ge(fal, 40) && ge(maths, 40) && countGe(others, 40) >= 3 && countGe(others, 30) >= 2;
  }

  protected outcomeLabel(report: ReportCardFull): string {
    const r = this.meetsPromotion(report);
    return r === null ? '—' : r ? 'Meets' : 'Does not meet';
  }

  protected readonly filteredReports = computed(() => {
    const f = this.filterOutcome();
    if (f === 'all') return this.reports();
    return this.reports().filter((r) => {
      const m = this.meetsPromotion(r);
      return f === 'pass' ? m === true : m === false;
    });
  });

  // ----- actions -----

  protected async createReports(): Promise<void> {
    if (!this.selectedClassId()) return;
    await this.run(async () => {
      const count = await this.staff.ensureTermReports(this.selectedClassId(), this.term());
      await this.loadReports();
      this.notice.set(`Ready to capture ${count} learners' marks.`);
    });
  }

  protected async onMark(report: ReportCardFull, subjectId: string, value: string): Promise<void> {
    const mark = value === '' ? null : Number(value);
    if (mark !== null && (isNaN(mark) || mark < 0 || mark > 100)) {
      this.error.set('A mark must be between 0 and 100.');
      return;
    }
    await this.quietRun(async () => {
      await this.staff.saveMark(report.id, subjectId, mark);
      const m = report.report_marks.find((x) => x.subjects?.id === subjectId);
      if (m) m.mark = mark;
      this.reports.set([...this.reports()]);
    });
  }

  protected async onAbsent(report: ReportCardFull, value: string): Promise<void> {
    const days = value === '' ? null : Number(value);
    await this.quietRun(() => this.staff.setReportMeta(report.id, days, report.teacher_comment));
  }

  protected async onComment(report: ReportCardFull, value: string): Promise<void> {
    report.teacher_comment = value;
    await this.quietRun(() => this.staff.setReportMeta(report.id, report.days_absent, value || null));
  }

  protected async approve(): Promise<void> {
    if (!confirm('Approve all draft reports for this class and term? They can no longer be edited.')) return;
    await this.run(async () => {
      const n = await this.staff.approveClassReports(this.selectedClassId(), this.term());
      await this.loadReports();
      this.notice.set(`Approved ${n} reports. You can now publish them to parents.`);
    });
  }

  protected async publish(): Promise<void> {
    if (!confirm('Publish approved reports? Connected parents will be notified and can view them.')) return;
    await this.run(async () => {
      const n = await this.staff.publishClassReports(this.selectedClassId(), this.term());
      await this.loadReports();
      this.notice.set(`Published ${n} reports. Parents have been notified.`);
    });
  }

  protected async changeTerm(term: number): Promise<void> {
    this.term.set(term);
    await this.run(() => this.loadReports());
  }

  // ----- loading -----

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.grades.set(await this.directory.grades());
      let options: ClassOption[];
      if (this.staff.isAdmin()) {
        options = (await this.staff.classes(this.year())).map((c) => ({ id: c.id, grade_code: c.grade_code, name: c.name, academic_year: c.academic_year }));
      } else {
        options = (await this.staff.myClasses())
          .filter((c) => c.academic_year === this.year())
          .map((c) => ({ id: c.id, grade_code: c.grade_code, name: c.name, academic_year: c.academic_year }));
      }
      this.classOptions.set(options);
      if (options.length > 0) this.selectedClassId.set(options[0].id);
      await this.loadReports();
    } catch (err) {
      console.error(err);
      this.error.set('Could not load reports.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadReports(): Promise<void> {
    if (!this.selectedClassId()) {
      this.reports.set([]);
      return;
    }
    this.reports.set(await this.staff.classReports(this.selectedClassId(), this.year(), this.term()));
  }

  private async run(action: () => Promise<void>, failure = 'Something went wrong.'): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try { await action(); } catch (err) { console.error(err); this.error.set(failure); } finally { this.busy.set(false); }
  }

  private async quietRun(action: () => Promise<void>): Promise<void> {
    this.error.set(null);
    try { await action(); } catch (err) { console.error(err); this.error.set('Could not save. The report may have been approved.'); }
  }

  // ----- export and print -----

  protected exportSchedule(): void {
    const cols = this.subjectColumns();
    const rows = this.filteredReports().map((r, i) => {
      const row: Record<string, string | number> = {
        '#': i + 1,
        Surname: r.learner?.last_name ?? '',
        'First name': r.learner?.first_name ?? '',
      };
      for (const s of cols) {
        const m = this.markFor(r, s.id);
        row[s.name] = m === null ? '' : m;
      }
      row['Average'] = this.average(r) ?? '';
      row['Outcome'] = this.outcomeLabel(r);
      return row;
    });
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Schedule');
    const cls = this.selectedClass();
    XLSX.writeFile(book, `Schedule - ${cls?.grade_code} ${cls?.name} Term ${this.term()} ${this.year()}.xlsx`);
  }

  protected printReport(report: ReportCardFull): void {
    const school = this.staff.currentSchool();
    const cls = this.selectedClass();
    const learner = report.learner;
    const stampUrl = printImageUrl(school?.stamp_url);
    const marks = [...report.report_marks].filter((m) => m.subjects).sort((a, b) => (a.subjects!.sort_order) - (b.subjects!.sort_order));
    const rows = marks.map((m) => {
      const lvl = achievementLevel(m.mark);
      const desc = this.levels.find((l) => l.level === lvl)?.description ?? '';
      return `<tr><td>${text(m.subjects!.name)}</td><td class="c">${text(m.mark)}</td><td class="c">${text(lvl)}</td><td>${text(desc)}</td></tr>`;
    }).join('');
    const codeTable = this.levels.map((l) => `<tr><td class="c">${text(l.level)}</td><td>${text(l.description)}</td><td class="c">${text(l.band)}</td></tr>`).join('');
    const html = `<!doctype html><html><head>${PRINT_DOCUMENT_POLICY}<title>Report ${text(learner?.first_name)} ${text(learner?.last_name)}</title><style>
      body{font-family:system-ui,Segoe UI,sans-serif;color:#14213d;padding:28px;max-width:800px;margin:auto}
      .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1f4bd8;padding-bottom:12px}
      .head h1{margin:0;font-size:20px;color:#1f4bd8} .head img{height:64px}
      h2{font-size:15px;margin:18px 0 6px} table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px} th{background:#f0f2f8}
      td.c,th.c{text-align:center} .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px;margin-top:8px}
      .sig{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:28px;font-size:12px}
      .sig div{border-top:1px solid #999;padding-top:4px} .small{font-size:11px;color:#666}
      @media print{body{padding:0}}</style></head><body>
      <div class="head"><div><h1>${text(school?.name)}</h1><div class="small">${text(school?.tagline)}</div></div>
        ${stampUrl ? `<img src="${text(stampUrl)}" alt="stamp" referrerpolicy="no-referrer" />` : ''}</div>
      <h2>Term ${text(report.term_number)} report · ${text(report.academic_year)}</h2>
      <div class="meta">
        <div><strong>Learner:</strong> ${text(learner?.first_name)} ${text(learner?.last_name)}</div>
        <div><strong>Class:</strong> ${text(cls?.grade_code)} ${text(cls?.name)}</div>
        <div><strong>Date of birth:</strong> ${text(learner?.date_of_birth)}</div>
        <div><strong>Days absent:</strong> ${text(report.days_absent ?? 0)}</div>
      </div>
      <h2>Subjects</h2>
      <table><thead><tr><th>Subject</th><th class="c">%</th><th class="c">Level</th><th>Achievement</th></tr></thead><tbody>${rows}</tbody></table>
      ${report.teacher_comment ? `<h2>Class teacher's comment</h2><p>${text(report.teacher_comment)}</p>` : ''}
      ${report.principal_comment ? `<h2>Principal's comment</h2><p>${text(report.principal_comment)}</p>` : ''}
      <h2>How to read the levels</h2>
      <table><thead><tr><th class="c">Level</th><th>Description</th><th class="c">%</th></tr></thead><tbody>${codeTable}</tbody></table>
      <div class="sig"><div>Class teacher</div><div>Principal</div><div>Parent / guardian</div></div>
      </body></html>`;
    openPrintDocument(html);
  }
}
