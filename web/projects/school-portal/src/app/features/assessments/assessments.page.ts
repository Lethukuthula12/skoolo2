import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import * as XLSX from 'xlsx';
import {
  ASSESSMENT_KIND_LABELS, Grade, Learner, SchoolDirectoryService, StaffService, achievementLevel,
} from '@skoolo/shared';
import type { Tables } from '@skoolo/shared';

type Assessment = Tables<'assessments'>;
type Subject = Tables<'subjects'>;
interface ClassOption { id: string; grade_code: string; name: string; academic_year: number; }
interface ScoreCell { score: number | null; is_absent: boolean; }
interface EditForm { id: string | null; title: string; kind: string; max_score: number; weight: number; assessed_on: string; }

@Component({
  selector: 'app-assessments-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './assessments.page.html',
  styleUrl: './assessments.page.scss',
})
export class AssessmentsPage {
  protected readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);
  private readonly route = inject(ActivatedRoute);

  protected readonly kindLabels = ASSESSMENT_KIND_LABELS;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly grades = signal<Grade[]>([]);
  protected readonly classOptions = signal<ClassOption[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly year = signal(new Date().getFullYear() + 1);
  protected readonly term = signal(1);
  protected readonly selectedClassId = signal<string>('');
  protected readonly selectedSubjectId = signal<string>('');

  protected readonly learners = signal<Learner[]>([]);
  protected readonly assessments = signal<Assessment[]>([]);
  // keyed `${assessmentId}:${learnerId}`
  protected readonly scores = signal<Record<string, ScoreCell>>({});

  protected editForm: EditForm = this.blankForm();

  protected readonly selectedClass = computed(() => this.classOptions().find((c) => c.id === this.selectedClassId()) ?? null);
  protected readonly subjectsForClass = computed(() => {
    const cls = this.selectedClass();
    return cls ? this.subjects().filter((s) => s.grade_code === cls.grade_code) : [];
  });
  protected readonly totalWeight = computed(() => this.assessments().reduce((sum, a) => sum + Number(a.weight), 0));

  constructor() {
    const year = Number(this.route.snapshot.queryParamMap.get('year'));
    const term = Number(this.route.snapshot.queryParamMap.get('term'));
    if (Number.isInteger(year) && year >= 2020 && year <= 2100) this.year.set(year);
    if (Number.isInteger(term) && term >= 1 && term <= 4) this.term.set(term);
    void this.load();
  }

  private blankForm(): EditForm {
    return { id: null, title: '', kind: 'test', max_score: 100, weight: 1, assessed_on: '' };
  }

  protected scoreKey(assessmentId: string, learnerId: string): string {
    return `${assessmentId}:${learnerId}`;
  }

  protected cell(assessmentId: string, learnerId: string): ScoreCell | undefined {
    return this.scores()[this.scoreKey(assessmentId, learnerId)];
  }

  /** The live weighted term mark for a learner, computed exactly as the server does. */
  protected termMark(learnerId: string): number | null {
    let num = 0, den = 0;
    for (const a of this.assessments()) {
      const c = this.cell(a.id, learnerId);
      if (!c || c.score === null || c.is_absent) continue;
      num += (c.score / Number(a.max_score) * 100) * Number(a.weight);
      den += Number(a.weight);
    }
    return den > 0 ? Math.round((num / den) * 100) / 100 : null;
  }

  protected levelFor(mark: number | null): number | null {
    return achievementLevel(mark);
  }

  protected pct(assessment: Assessment, learnerId: string): number | null {
    const c = this.cell(assessment.id, learnerId);
    if (!c || c.score === null || c.is_absent) return null;
    return Math.round((c.score / Number(assessment.max_score)) * 100);
  }

  // ----- capture -----

  protected async onScore(assessment: Assessment, learner: Learner, value: string): Promise<void> {
    const score = value.trim() === '' ? null : Number(value);
    if (score !== null && (isNaN(score) || score < 0)) { this.error.set('A score cannot be negative.'); return; }
    if (score !== null && score > Number(assessment.max_score)) {
      this.error.set(`The maximum for ${assessment.title} is ${assessment.max_score}.`);
      return;
    }
    const key = this.scoreKey(assessment.id, learner.id);
    this.error.set(null);
    try {
      await this.staff.saveAssessmentScore(assessment.id, learner.id, score, false);
      this.scores.set({ ...this.scores(), [key]: { score, is_absent: false } });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not save the score.');
    }
  }

  // ----- assessments -----

  protected selectForEdit(a: Assessment): void {
    this.editForm = {
      id: a.id, title: a.title, kind: a.kind, max_score: Number(a.max_score),
      weight: Number(a.weight), assessed_on: a.assessed_on ?? '',
    };
  }

  protected cancelEdit(): void {
    this.editForm = this.blankForm();
  }

  protected async saveAssessment(): Promise<void> {
    const f = this.editForm;
    if (!f.title.trim()) { this.error.set('Give the assessment a title.'); return; }
    if (!this.selectedSubjectId()) { this.error.set('Choose a subject first.'); return; }
    await this.run(async () => {
      await this.staff.saveAssessment({
        id: f.id, classId: this.selectedClassId(), subjectId: this.selectedSubjectId(), term: this.term(),
        title: f.title.trim(), kind: f.kind, maxScore: Number(f.max_score) || 100, weight: Number(f.weight) || 1,
        assessedOn: f.assessed_on || null,
      });
      this.editForm = this.blankForm();
      await this.loadGrid();
      this.notice.set('Assessment saved.');
    }, null);
  }

  protected async deleteAssessment(a: Assessment): Promise<void> {
    if (!confirm(`Remove "${a.title}" and its scores? Term marks will be recalculated.`)) return;
    await this.run(async () => {
      await this.staff.deleteAssessment(a.id);
      if (this.editForm.id === a.id) this.editForm = this.blankForm();
      await this.loadGrid();
      this.notice.set('Assessment removed.');
    }, null);
  }

  // ----- loading -----

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.grades.set(await this.directory.grades());
      this.subjects.set(await this.staff.subjects());
      let options: ClassOption[];
      if (this.staff.isAdmin()) {
        options = (await this.staff.classes(this.year())).map((c) => ({ id: c.id, grade_code: c.grade_code, name: c.name, academic_year: c.academic_year }));
      } else {
        options = (await this.staff.myClasses()).filter((c) => c.academic_year === this.year())
          .map((c) => ({ id: c.id, grade_code: c.grade_code, name: c.name, academic_year: c.academic_year }));
      }
      this.classOptions.set(options);
      const requestedClass = this.route.snapshot.queryParamMap.get('class');
      this.selectedClassId.set(options.find(c => c.id === requestedClass)?.id ?? options[0]?.id ?? '');
      const subs = this.subjectsForClass();
      const requestedSubject = this.route.snapshot.queryParamMap.get('subject');
      this.selectedSubjectId.set(subs.find(s => s.id === requestedSubject)?.id ?? subs[0]?.id ?? '');
      await this.loadGrid();
    } catch (err) {
      console.error(err);
      this.error.set('Could not load assessments.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async onClassChange(): Promise<void> {
    const subs = this.subjectsForClass();
    this.selectedSubjectId.set(subs[0]?.id ?? '');
    this.editForm = this.blankForm();
    await this.run(() => this.loadGrid());
  }

  protected async reload(): Promise<void> {
    this.editForm = this.blankForm();
    await this.run(() => this.loadGrid());
  }

  private async loadGrid(): Promise<void> {
    if (!this.selectedClassId() || !this.selectedSubjectId()) {
      this.assessments.set([]); this.learners.set([]); this.scores.set({});
      return;
    }
    const [learners, assessments] = await Promise.all([
      this.staff.classLearners(this.selectedClassId()),
      this.staff.assessments(this.selectedClassId(), this.selectedSubjectId(), this.term()),
    ]);
    this.learners.set(learners);
    this.assessments.set(assessments);
    const rows = await this.staff.assessmentScores(assessments.map((a) => a.id));
    const map: Record<string, ScoreCell> = {};
    for (const r of rows) map[this.scoreKey(r.assessment_id, r.learner_id)] = { score: r.score, is_absent: r.is_absent };
    this.scores.set(map);
  }

  private async run(action: () => Promise<void>, failure: string | null = 'Something went wrong.'): Promise<void> {
    this.busy.set(true); this.error.set(null); this.notice.set(null);
    try { await action(); } catch (err) {
      console.error(err);
      this.error.set(failure ?? (err instanceof Error ? err.message : 'Something went wrong.'));
    } finally { this.busy.set(false); }
  }

  // ----- analysis export -----

  protected exportAnalysis(): void {
    const cls = this.selectedClass();
    const subject = this.subjectsForClass().find((s) => s.id === this.selectedSubjectId());
    const as = this.assessments();
    const ls = [...this.learners()].sort((a, b) => a.last_name.localeCompare(b.last_name));

    // Scores sheet: learners x assessments + term mark
    const scoreRows = ls.map((l, i) => {
      const row: Record<string, string | number> = { '#': i + 1, Surname: l.last_name, 'First name': l.first_name };
      for (const a of as) {
        const c = this.cell(a.id, l.id);
        row[`${a.title} (/${a.max_score})`] = c?.score ?? '';
      }
      row['Term mark %'] = this.termMark(l.id) ?? '';
      return row;
    });

    // Per-assessment sheet: count, average %, min %, max %
    const perAssessment = as.map((a) => {
      const pcts = ls.map((l) => this.pct(a, l.id)).filter((p): p is number => p !== null);
      const avg = pcts.length ? Math.round((pcts.reduce((x, y) => x + y, 0) / pcts.length) * 10) / 10 : '';
      return {
        Assessment: a.title, Kind: this.kindLabels[a.kind] ?? a.kind, Max: Number(a.max_score), Weight: Number(a.weight),
        Captured: pcts.length, 'Average %': avg, 'Lowest %': pcts.length ? Math.min(...pcts) : '', 'Highest %': pcts.length ? Math.max(...pcts) : '',
      };
    });

    // Per-subject sheet: term-mark distribution by achievement level
    const termMarks = ls.map((l) => this.termMark(l.id)).filter((m): m is number => m !== null);
    const perSubject = [7, 6, 5, 4, 3, 2, 1].map((lvl) => ({
      Level: lvl,
      Learners: termMarks.filter((m) => achievementLevel(m) === lvl).length,
    }));
    perSubject.push({ Level: 'Average %' as unknown as number, Learners: termMarks.length ? Math.round((termMarks.reduce((a, b) => a + b, 0) / termMarks.length) * 10) / 10 : 0 });

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(scoreRows), 'Scores');
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(perAssessment), 'Per assessment');
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(perSubject), 'Per subject');
    XLSX.writeFile(book, `Assessments - ${cls?.grade_code} ${cls?.name} ${subject?.name} Term ${this.term()} ${this.year()}.xlsx`);
  }
}
