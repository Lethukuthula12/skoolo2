import { DatePipe } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ActionFeedbackComponent, AuthService, StaffService } from '@skoolo/shared';
import type { Json, Tables } from '@skoolo/shared';
import { BLOCK_LABELS, BlockType, Paper, PaperContent, PaperEvent, PaperQuestion, PaperTemplate, blankQuestion, paperQuestions, questionTotal } from './paper.model';
import { PaperOption, PaperService, PaperSummary, Reviewer } from './paper.service';
import { paperPrintHtml, printPaper } from './paper-print';

@Component({
  selector: 'app-papers-page',
  imports: [ActionFeedbackComponent, ReactiveFormsModule, DatePipe, RouterLink],
  templateUrl: './papers.page.html',
  styleUrl: './papers.page.scss',
})
export class PapersPage {
  protected readonly staff = inject(StaffService);
  protected readonly auth = inject(AuthService);
  private readonly service = inject(PaperService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly sanitizer = inject(DomSanitizer);
  private epoch = 0;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly papers = signal<PaperSummary[]>([]);
  protected readonly options = signal<PaperOption[]>([]);
  protected readonly reviewers = signal<Reviewer[]>([]);
  protected readonly templates = signal<PaperTemplate[]>([]);
  protected readonly paper = signal<Paper | null>(null);
  protected readonly editing = signal(false);
  protected readonly history = signal<PaperEvent[]>([]);
  protected readonly showPreview = signal(false);
  protected readonly memorandum = signal(false);
  protected readonly showTemplates = signal(false);
  protected readonly templateId = signal<string | null>(null);
  protected readonly filter = signal('all');
  protected readonly search = signal('');
  protected readonly existingAssessments = signal<Tables<'assessments'>[]>([]);
  protected readonly blockLabels = BLOCK_LABELS;
  protected readonly blockTypes = Object.keys(BLOCK_LABELS) as BlockType[];
  protected readonly statusLabels: Record<string, string> = { draft: 'Draft', in_review: 'Awaiting review', approved: 'Approved' };
  protected readonly eventLabels: Record<string, string> = { created: 'Draft created', submit: 'Submitted for review', withdraw: 'Withdrawn to draft', return: 'Corrections requested', approve: 'Approved', revised: 'Revision created', linked_assessment: 'Connected to mark capture' };

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    class_id: ['', Validators.required], subject_id: ['', Validators.required], reviewer_id: ['', Validators.required],
    term_number: [1, [Validators.required, Validators.min(1), Validators.max(4)]], kind: ['test'], assessed_on: [''],
    duration_minutes: [60, [Validators.required, Validators.min(1), Validators.max(600)]],
    instructions: ['', Validators.maxLength(5000)], footer: ['', Validators.maxLength(500)],
    questions: new FormArray<ReturnType<PapersPage['questionForm']>>([]),
  });
  protected readonly content = signal<PaperContent>(this.form.getRawValue());
  protected readonly feedback = this.fb.control('', Validators.maxLength(5000));
  protected readonly assessmentId = this.fb.control('');
  protected readonly weight = this.fb.control(1, [Validators.required, Validators.min(0.01), Validators.max(9999)]);
  protected readonly templateForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    instructions: ['', Validators.maxLength(5000)],
    duration_minutes: [60, [Validators.required, Validators.min(1), Validators.max(600)]],
    footer: ['', Validators.maxLength(500)],
  });
  protected readonly classes = computed(() => [...new Map(this.options().map(o => [o.class_id, o])).values()]);
  protected readonly subjects = computed(() => this.options().filter(o => o.class_id === this.content().class_id));
  protected readonly total = computed(() => questionTotal(this.content().questions));
  protected readonly isAuthor = computed(() => !this.paper() || this.paper()?.author_id === this.auth.user()?.id);
  protected readonly canEdit = computed(() => this.isAuthor() && (!this.paper() || this.paper()?.status === 'draft'));
  protected readonly canReview = computed(() => this.paper()?.status === 'in_review' && this.staff.isAdmin() && this.paper()?.reviewer_id === this.auth.user()?.id);
  protected readonly canLink = computed(() => this.options().some(o => o.class_id === this.paper()?.class_id && o.subject_id === this.paper()?.subject_id) && (this.isAuthor() || this.staff.isAdmin()));
  protected readonly filtered = computed(() => this.papers().filter(p =>
    (this.filter() === 'all' || (this.filter() === 'review' ? p.status === 'in_review' && p.reviewer_id === this.auth.user()?.id : p.status === this.filter())) &&
    p.title.toLocaleLowerCase().includes(this.search().toLocaleLowerCase())));
  protected readonly preview = computed(() => {
    if (!this.showPreview()) return null;
    // Only our escaped, script-free renderer is trusted, inside a sandboxed iframe.
    return this.sanitizer.bypassSecurityTrustHtml(paperPrintHtml(this.previewPaper(), this.memorandum()));
  });

  constructor() {
    const subscription = this.form.valueChanges.subscribe(() => this.content.set(this.form.getRawValue()));
    inject(DestroyRef).onDestroy(() => { subscription.unsubscribe(); this.epoch++; });
    effect(() => {
      const school = this.staff.currentSchoolId();
      const user = this.auth.user()?.id;
      const epoch = ++this.epoch;
      this.papers.set([]); this.paper.set(null); this.editing.set(false); this.showPreview.set(false);
      this.options.set([]); this.reviewers.set([]); this.templates.set([]); this.history.set([]);
      this.existingAssessments.set([]); this.form.reset(); this.form.controls.questions.clear(); this.form.markAsPristine();
      this.templateForm.reset(); this.showTemplates.set(false); this.templateId.set(null);
      this.error.set(''); this.notice.set(''); this.busy.set(false);
      if (school && user) void this.load(epoch);
    });
  }
  private async load(epoch = this.epoch): Promise<void> {
    this.loading.set(true);
    try {
      const [papers, options, reviewers, templates] = await Promise.all([this.service.list(), this.service.options(), this.service.reviewers(), this.service.templates()]);
      if (epoch !== this.epoch) return;
      this.papers.set(papers); this.options.set(options); this.reviewers.set(reviewers); this.templates.set(templates);
    } catch (error) { if (epoch === this.epoch) this.error.set(this.message(error)); }
    finally { if (epoch === this.epoch) this.loading.set(false); }
  }
  protected reload(): void { if (this.canLeave()) { this.editing.set(false); void this.load(); } }
  protected questionForm(q: PaperQuestion) {
    return this.fb.group({
      type: [q.type], text: [q.text, Validators.maxLength(10000)],
      marks: [q.marks, [Validators.required, Validators.min(0), Validators.max(999)]],
      lines: [q.lines, [Validators.required, Validators.min(0), Validators.max(30), Validators.pattern(/^\d+$/)]],
      options: [q.options, Validators.maxLength(5000)], cells: [q.cells, Validators.maxLength(10000)],
      image: [q.image], answer: [q.answer, Validators.maxLength(10000)],
    });
  }
  protected get questions() { return this.form.controls.questions; }
  protected addBlock(type: BlockType): void {
    if (!this.canEdit() || this.questions.length >= 100) return;
    this.questions.push(this.questionForm(blankQuestion(type))); this.form.markAsDirty();
  }
  protected removeBlock(index: number): void { this.questions.removeAt(index); this.form.markAsDirty(); }
  protected moveBlock(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.questions.length) return;
    const block = this.questions.at(index); this.questions.removeAt(index); this.questions.insert(target, block); this.form.markAsDirty();
  }
  protected questionNumber(index: number): number {
    return this.content().questions.slice(0, index + 1).filter(q => !['section', 'page_break'].includes(q.type)).length;
  }
  protected changeClass(): void { this.form.controls.subject_id.setValue(this.subjects()[0]?.subject_id ?? ''); }
  protected applyTemplate(id: string): void {
    const template = this.templates().find(t => t.id === id);
    if (!template) return;
    this.form.patchValue({ instructions: template.instructions, duration_minutes: template.duration_minutes, footer: template.footer });
    this.form.markAsDirty();
  }
  protected start(): void {
    if (!this.canLeave()) return;
    this.paper.set(null); this.history.set([]); this.error.set(''); this.notice.set(''); this.showPreview.set(false); this.memorandum.set(false);
    this.form.reset(); this.questions.clear();
    const first = this.options()[0];
    this.form.patchValue({ title: '', class_id: first?.class_id ?? '', subject_id: first?.subject_id ?? '', reviewer_id: this.reviewers()[0]?.user_id ?? '' });
    this.addBlock('short'); this.form.markAsPristine(); this.editing.set(true);
  }
  protected back(): void { if (this.canLeave()) { this.editing.set(false); this.showPreview.set(false); } }
  protected async open(id: string): Promise<void> {
    if (!this.canLeave()) return;
    await this.run(async epoch => {
      const paper = await this.service.get(id);
      if (epoch !== this.epoch) return;
      this.setPaper(paper); this.editing.set(true); await this.loadDetails(paper, epoch);
    });
  }
  private setPaper(paper: Paper): void {
    this.paper.set(paper); this.questions.clear();
    for (const question of paperQuestions(paper)) this.questions.push(this.questionForm(question), { emitEvent: false });
    const { questions: storedQuestions, ...details } = paper;
    this.form.patchValue({ ...details, assessed_on: paper.assessed_on ?? '' }, { emitEvent: false });
    this.content.set(this.form.getRawValue()); this.form.markAsPristine(); this.feedback.reset();
    this.showPreview.set(!this.canEdit()); this.memorandum.set(false);
  }
  private async loadDetails(paper: Paper, epoch: number): Promise<void> {
    const [events, assessments] = await Promise.all([
      this.service.history(paper.id),
      this.canLink() ? this.staff.assessments(paper.class_id, paper.subject_id, paper.term_number) : Promise.resolve([]),
    ]);
    if (epoch !== this.epoch || this.paper()?.id !== paper.id) return;
    this.history.set(events); this.existingAssessments.set(assessments.filter(a => a.max_score === paper.total_marks)); this.assessmentId.reset();
  }
  protected async save(): Promise<void> {
    if (!this.validDraft()) return;
    await this.run(async epoch => {
      const saved = await this.service.save(this.paper(), this.form.getRawValue());
      if (epoch !== this.epoch) return;
      this.paper.set(saved); this.form.markAsPristine(); this.notice.set('Draft saved. You can return to it from Forms & Documents.');
      this.upsertSummary(saved);
    });
  }
  protected async transition(action: 'submit' | 'withdraw' | 'approve' | 'return'): Promise<void> {
    if (action === 'submit' && !this.validDraft()) return;
    await this.run(async epoch => {
      let paper = this.paper();
      if (action === 'submit' && (!paper || this.form.dirty)) {
        paper = await this.service.save(paper, this.form.getRawValue());
        if (epoch !== this.epoch) return;
        this.paper.set(paper); this.form.markAsPristine(); this.upsertSummary(paper);
      }
      if (!paper) return;
      const result = await this.service.transition(paper, action, this.feedback.value);
      if (epoch !== this.epoch) return;
      this.setPaper(result); this.upsertSummary(result); this.notice.set(this.eventLabels[action]);
      await this.loadDetails(result, epoch);
    });
  }
  protected async revise(): Promise<void> {
    const paper = this.paper(); if (!paper) return;
    await this.run(async epoch => {
      const revised = await this.service.revise(paper);
      if (epoch !== this.epoch) return;
      this.setPaper(revised); this.upsertSummary(revised); this.notice.set('New draft created. The original approved paper is unchanged.');
      await this.loadDetails(revised, epoch);
    });
  }
  protected async linkAssessment(): Promise<void> {
    const paper = this.paper(); if (!paper || (!this.assessmentId.value && this.weight.invalid)) { this.error.set('Enter a positive assessment weight.'); return; }
    await this.run(async epoch => {
      const linked = await this.service.link(paper, this.assessmentId.value || null, this.weight.value);
      if (epoch !== this.epoch) return;
      this.paper.set(linked); this.upsertSummary(linked); this.notice.set('Connected. Capture learner scores in Assessments.');
      await this.loadDetails(linked, epoch);
    });
  }
  protected async uploadImage(index: number, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      this.error.set('Choose a PNG, JPEG or WebP image under 1 MB.'); return;
    }
    const control = this.questions.at(index); const epoch = this.epoch;
    await this.run(async () => {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read the image.'));
        reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file);
      });
      // Decode before accepting content, excluding corrupt or disguised files.
      const decoded = new Image(); decoded.src = image; await decoded.decode();
      if (epoch !== this.epoch || !this.questions.controls.includes(control)) return;
      control.controls.image.setValue(image); this.form.markAsDirty();
    });
  }
  private previewPaper(): Paper {
    const content = this.content();
    const option = this.options().find(o => o.class_id === content.class_id && o.subject_id === content.subject_id);
    return { ...this.paper(), ...content, questions: content.questions as unknown as Json,
      status: this.paper()?.status ?? 'draft', total_marks: this.total(),
      display_context: this.paper()?.status === 'approved' ? this.paper()!.display_context : {
        school_name: this.staff.currentSchool()?.name ?? '', badge_url: this.staff.currentSchool()?.badge_url ?? '',
        class_name: option ? `${option.grade_code} ${option.class_name}` : this.context(this.paper(), 'class_name'),
        subject_name: option?.subject_name ?? this.context(this.paper(), 'subject_name'),
        academic_year: option?.academic_year ?? this.context(this.paper(), 'academic_year'),
      },
    } as Paper;
  }
  protected async print(memo: boolean): Promise<void> { await this.run(async () => { await printPaper(this.previewPaper(), memo); }); }
  protected context(paper: PaperSummary | Paper | null, key: string): string {
    return String((paper?.display_context as Record<string, unknown> | null)?.[key] ?? '');
  }
  protected editTemplate(template: PaperTemplate | null): void {
    this.templateId.set(template?.id ?? null); this.templateForm.reset(); if (template) this.templateForm.patchValue(template);
  }
  protected async saveTemplate(): Promise<void> {
    if (this.templateForm.invalid || !this.templateForm.controls.name.value.trim()) { this.error.set('Give the template a name and a duration from 1 to 600 minutes.'); return; }
    await this.run(async epoch => {
      await this.service.saveTemplate(this.templateForm.getRawValue(), this.templateId());
      const templates = await this.service.templates(); if (epoch !== this.epoch) return;
      this.templates.set(templates); this.editTemplate(null); this.notice.set('School template saved.');
    });
  }
  protected async deleteTemplate(template: PaperTemplate): Promise<void> {
    if (!confirm(`Remove the template “${template.name}”? Existing papers keep their content.`)) return;
    await this.run(async epoch => {
      await this.service.deleteTemplate(template.id);
      if (epoch !== this.epoch) return;
      this.templates.update(list => list.filter(t => t.id !== template.id)); this.editTemplate(null);
      this.notice.set('School template removed.');
    });
  }
  private validDraft(): boolean {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.title.value.trim()) {
      this.error.set('Add a title, class, subject and reviewer. Check the duration, marks and answer lines.'); return false;
    }
    return true;
  }
  private upsertSummary(paper: Paper): void { this.papers.update(list => [paper, ...list.filter(p => p.id !== paper.id)]); }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'Could not complete the action. Please try again.'; }
  private async run(action: (epoch: number) => Promise<void>): Promise<void> {
    if (this.busy()) return;
    const epoch = this.epoch; this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await action(epoch); } catch (error) { if (epoch === this.epoch) this.error.set(this.message(error)); }
    finally { if (epoch === this.epoch) this.busy.set(false); }
  }
  canLeave(): boolean {
    return this.busy() ? false : (!this.editing() || !this.form.dirty || !this.canEdit() || confirm('Leave without saving your latest changes?'));
  }
  @HostListener('window:beforeunload', ['$event'])
  protected warnUnsaved(event: BeforeUnloadEvent): void {
    if (this.editing() && this.canEdit() && (this.form.dirty || this.busy())) { event.preventDefault(); event.returnValue = ''; }
  }
}
