import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionFeedbackComponent, ClassRow, ClassSubjectTeacherRow, Grade, LANGUAGE_LEVEL_LABELS, SchoolDirectoryService, StaffMember,
  StaffService, Subject, } from '@skoolo/shared';

@Component({
  selector: 'app-classes-page',
  imports: [ActionFeedbackComponent, FormsModule],
  templateUrl: './classes.page.html',
  styleUrl: './classes.page.scss',
})
export class ClassesPage {
  private readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);

  protected readonly languageLevels = LANGUAGE_LEVEL_LABELS;
  protected readonly tab = signal<'classes' | 'subjects'>('classes');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly grades = signal<Grade[]>([]);
  protected readonly teachers = signal<StaffMember[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly classes = signal<ClassRow[]>([]);
  protected readonly learnerCounts = signal<Record<string, number>>({});
  protected readonly year = signal(new Date().getFullYear() + 1);

  protected readonly expandedClassId = signal<string | null>(null);
  protected readonly classAssignments = signal<ClassSubjectTeacherRow[]>([]);

  // New-class form
  protected newClass = { grade_code: '', name: '', class_teacher_id: '' };
  // New-subject form
  protected newSubject = { grade_code: '', name: '', language_level: '' };

  protected readonly schoolGrades = computed(() => {
    const school = this.staff.currentSchool();
    const lo = this.grades().find((g) => g.code === school?.lowest_grade)?.sort_order ?? 0;
    const hi = this.grades().find((g) => g.code === school?.highest_grade)?.sort_order ?? 99;
    return this.grades().filter((g) => g.sort_order >= lo && g.sort_order <= hi);
  });

  private readonly thresholdSort = computed(() => {
    const code = this.staff.currentSchool()?.subject_teaching_from_grade ?? 'G4';
    return this.grades().find((g) => g.code === code)?.sort_order ?? 7;
  });

  constructor() {
    void this.load();
  }

  protected gradeLabel(code: string): string {
    return this.grades().find((g) => g.code === code)?.label ?? code;
  }

  protected isSubjectTeaching(gradeCode: string): boolean {
    const sort = this.grades().find((g) => g.code === gradeCode)?.sort_order ?? 0;
    return sort >= this.thresholdSort();
  }

  protected teacherName(id: string | null | undefined): string {
    if (!id) return 'Not assigned';
    const t = this.teachers().find((m) => m.id === id);
    return t ? `${t.first_name} ${t.last_name}` : 'Not assigned';
  }

  protected subjectsForGrade(gradeCode: string): Subject[] {
    return this.subjects().filter((s) => s.grade_code === gradeCode);
  }

  protected learnerCount(classId: string): number {
    return this.learnerCounts()[classId] ?? 0;
  }

  // ----- Classes -----

  protected async addClass(): Promise<void> {
    if (!this.newClass.grade_code || !this.newClass.name.trim()) return;
    await this.run(async () => {
      await this.staff.saveClass({
        academic_year: this.year(),
        grade_code: this.newClass.grade_code,
        name: this.newClass.name.trim(),
        class_teacher_id: this.newClass.class_teacher_id || null,
      });
      this.newClass = { grade_code: '', name: '', class_teacher_id: '' };
      this.notice.set('Class added.');
      await this.loadClasses();
    }, 'Could not add the class. A class with that name may already exist for this grade and year.');
  }

  protected async updateClassTeacher(cls: ClassRow, teacherId: string): Promise<void> {
    await this.run(async () => {
      await this.staff.saveClass({ id: cls.id, academic_year: cls.academic_year, grade_code: cls.grade_code, name: cls.name, class_teacher_id: teacherId || null });
      await this.loadClasses();
      this.notice.set('Class teacher saved.');
    });
  }

  protected async removeClass(cls: ClassRow): Promise<void> {
    if (!confirm(`Delete ${this.gradeLabel(cls.grade_code)} ${cls.name}? Learners in it are not deleted but lose their class.`)) return;
    await this.run(async () => {
      await this.staff.deleteClass(cls.id);
      this.notice.set('Class deleted.');
      await this.loadClasses();
    });
  }

  protected async toggleAssignments(cls: ClassRow): Promise<void> {
    if (this.expandedClassId() === cls.id) {
      this.expandedClassId.set(null);
      return;
    }
    this.expandedClassId.set(cls.id);
    this.classAssignments.set(await this.staff.classSubjectTeachers(cls.id));
  }

  protected teacherForSubject(subjectId: string): string {
    return this.classAssignments().find((a) => a.subject_id === subjectId)?.teacher_id ?? '';
  }

  protected async assignSubjectTeacher(classId: string, subjectId: string, teacherId: string): Promise<void> {
    await this.run(async () => {
      await this.staff.assignSubjectTeacher(classId, subjectId, teacherId || null);
      this.classAssignments.set(await this.staff.classSubjectTeachers(classId));
      this.notice.set('Teacher assigned.');
    });
  }

  // ----- Subjects -----

  protected async addCapsDefaults(): Promise<void> {
    await this.run(async () => {
      const added = await this.staff.seedDefaultSubjects();
      this.subjects.set(await this.staff.subjects());
      this.notice.set(added > 0 ? `Added ${added} CAPS subjects. Edit them to match your school.` : 'Your subjects already cover the CAPS defaults.');
    });
  }

  protected async addSubject(): Promise<void> {
    if (!this.newSubject.grade_code || !this.newSubject.name.trim()) return;
    await this.run(async () => {
      const existing = this.subjects().filter((s) => s.grade_code === this.newSubject.grade_code).length;
      await this.staff.saveSubject({
        grade_code: this.newSubject.grade_code,
        name: this.newSubject.name.trim(),
        language_level: this.newSubject.language_level || null,
        sort_order: existing + 1,
      });
      this.newSubject = { grade_code: this.newSubject.grade_code, name: '', language_level: '' };
      this.subjects.set(await this.staff.subjects());
      this.notice.set('Subject added.');
    }, 'Could not add the subject. It may already exist for that grade.');
  }

  protected async removeSubject(s: Subject): Promise<void> {
    if (!confirm(`Delete ${s.name} for ${this.gradeLabel(s.grade_code)}?`)) return;
    await this.run(async () => {
      await this.staff.deleteSubject(s.id);
      this.subjects.set(await this.staff.subjects());
      this.notice.set('Subject deleted.');
    });
  }

  // ----- loading -----

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [grades, teachers, subjects] = await Promise.all([
        this.directory.grades(), this.staff.staffMembers(), this.staff.subjects(),
      ]);
      this.grades.set(grades);
      this.teachers.set(teachers);
      this.subjects.set(subjects);
      await this.loadClasses();
    } catch (err) {
      console.error(err);
      this.error.set('Could not load classes and subjects.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadClasses(): Promise<void> {
    const [classes, learners] = await Promise.all([this.staff.classes(this.year()), this.staff.schoolLearners()]);
    this.classes.set(classes);
    const counts: Record<string, number> = {};
    for (const l of learners) {
      if (l.current_class_id) counts[l.current_class_id] = (counts[l.current_class_id] ?? 0) + 1;
    }
    this.learnerCounts.set(counts);
  }

  protected async changeYear(year: number): Promise<void> {
    this.year.set(year);
    await this.run(() => this.loadClasses());
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
