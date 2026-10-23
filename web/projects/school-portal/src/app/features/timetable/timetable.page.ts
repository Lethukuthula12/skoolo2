import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MyClass, MyTimetableRow, SchoolDirectoryService, SchoolTimetableRow, StaffService, WEEKDAYS,
} from '@skoolo/shared';
import type { Tables } from '@skoolo/shared';

type Period = Tables<'school_periods'>;
type Subject = Tables<'subjects'>;
type StaffMember = Tables<'staff_members'>;

interface AddForm { day: number; periodId: string; classId: string; subjectId: string; }
interface NewPeriod { name: string; starts_at: string; ends_at: string; is_break: boolean; }

@Component({
  selector: 'app-timetable-page',
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './timetable.page.html',
  styleUrl: './timetable.page.scss',
})
export class TimetablePage {
  protected readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);

  // Grade sort orders and the school's subject-teaching threshold, to decide which subjects a
  // teacher may place in a class — the same rule place_lesson enforces on the server.
  private readonly gradeOrder = new Map<string, number>();
  private thresholdOrder = 999;

  protected readonly weekdays = WEEKDAYS;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly year = signal(new Date().getFullYear() + 1);

  protected readonly periods = signal<Period[]>([]);
  protected readonly teachingPeriods = computed(() => this.periods().filter((p) => !p.is_break));

  // Teacher view
  protected readonly myStaffId = signal<string | null>(null);
  protected readonly myClasses = signal<MyClass[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly myLessons = signal<MyTimetableRow[]>([]);
  private readonly assignedSubjectIds = new Map<string, Set<string>>();  // classId -> subject ids I teach
  protected addForm: AddForm = { day: 1, periodId: '', classId: '', subjectId: '' };
  protected readonly formSubjects = signal<Subject[]>([]);

  // Admin view
  protected readonly tab = signal<'structure' | 'byClass' | 'byTeacher'>('structure');
  protected readonly classes = signal<{ id: string; name: string; grade_code: string }[]>([]);
  protected readonly staffMembers = signal<StaffMember[]>([]);
  protected readonly schoolLessons = signal<SchoolTimetableRow[]>([]);
  protected readonly selectedClassId = signal<string>('');
  protected readonly selectedTeacherId = signal<string>('');
  protected newPeriod: NewPeriod = { name: '', starts_at: '08:00', ends_at: '08:45', is_break: false };

  constructor() {
    void this.load();
  }

  protected get isAdmin(): boolean {
    return this.staff.isAdmin();
  }

  protected fmtTime(t: string | null | undefined): string {
    return (t ?? '').slice(0, 5);
  }

  // ----- loading -----

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.periods.set(await this.staff.schoolPeriods());
      if (this.isAdmin) {
        const [classes, members, lessons] = await Promise.all([
          this.staff.classes(this.year()),
          this.staff.staffMembers(),
          this.staff.schoolTimetable(this.year()),
        ]);
        this.classes.set(classes.map((c) => ({ id: c.id, name: c.name, grade_code: c.grade_code })));
        this.staffMembers.set(members);
        this.schoolLessons.set(lessons);
        if (classes.length && !this.selectedClassId()) this.selectedClassId.set(classes[0].id);
        if (members.length && !this.selectedTeacherId()) this.selectedTeacherId.set(members[0].id);
      } else {
        const [staffId, myClasses, subjects, lessons, grades] = await Promise.all([
          this.staff.myStaffMemberId(),
          this.staff.myClasses(),
          this.staff.subjects(),
          this.staff.myTimetable(this.year()),
          this.directory.grades(),
        ]);
        this.myStaffId.set(staffId);
        this.myClasses.set(myClasses.filter((c) => c.academic_year === this.year()));
        this.subjects.set(subjects);
        this.myLessons.set(lessons);
        for (const g of grades) this.gradeOrder.set(g.code, g.sort_order);
        this.thresholdOrder = this.gradeOrder.get(this.staff.currentSchool()?.subject_teaching_from_grade ?? 'G4') ?? 999;
      }
    } catch (err) {
      console.error(err);
      this.error.set('Could not load the timetable.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async changeYear(year: number): Promise<void> {
    this.year.set(year);
    await this.run(() => this.load());
  }

  // ----- teacher: place and remove -----

  /** The lesson in a (day, period) slot for the signed-in teacher, if any. */
  protected myLessonAt(day: number, periodId: string): MyTimetableRow | undefined {
    return this.myLessons().find((l) => l.day_of_week === day && l.period_id === periodId);
  }

  protected async onClassChange(classId: string): Promise<void> {
    this.addForm.subjectId = '';
    if (!classId) { this.formSubjects.set([]); return; }
    const cls = this.myClasses().find((c) => c.id === classId);
    if (!cls) { this.formSubjects.set([]); return; }
    const classTeacherGrade = (this.gradeOrder.get(cls.grade_code) ?? 999) < this.thresholdOrder;
    if (classTeacherGrade && cls.is_class_teacher) {
      // below the subject-teaching grade the class teacher may place any subject offered in the grade
      this.formSubjects.set(this.subjects().filter((s) => s.grade_code === cls.grade_code));
    } else {
      // at and above it, a teacher may place only the subjects they are assigned in this class
      let ids = this.assignedSubjectIds.get(classId);
      if (!ids) {
        const rows = await this.staff.classSubjectTeachers(classId);
        ids = new Set(rows.filter((r) => r.teacher_id === this.myStaffId()).map((r) => r.subject_id));
        this.assignedSubjectIds.set(classId, ids);
      }
      this.formSubjects.set(this.subjects().filter((s) => ids!.has(s.id)));
    }
  }

  protected async place(): Promise<void> {
    const f = this.addForm;
    if (!f.periodId || !f.classId || !f.subjectId) { this.error.set('Choose a day, period, class and subject.'); return; }
    await this.run(async () => {
      await this.staff.placeLesson(f.classId, f.subjectId, f.periodId, f.day);
      this.myLessons.set(await this.staff.myTimetable(this.year()));
      this.addForm.subjectId = '';
      this.notice.set('Lesson added.');
    }, null);
  }

  protected async remove(lesson: MyTimetableRow): Promise<void> {
    await this.run(async () => {
      await this.staff.removeLesson(lesson.id);
      this.myLessons.set(await this.staff.myTimetable(this.year()));
    });
  }

  // ----- admin: day structure -----

  protected async addPeriod(): Promise<void> {
    const p = this.newPeriod;
    if (!p.name.trim() || !p.starts_at || !p.ends_at) { this.error.set('Give the period a name, start and end.'); return; }
    if (p.ends_at <= p.starts_at) { this.error.set('The end time must be after the start time.'); return; }
    await this.run(async () => {
      const position = (this.periods().at(-1)?.position ?? 0) + 1;
      await this.staff.savePeriod({ name: p.name.trim(), starts_at: p.starts_at, ends_at: p.ends_at, is_break: p.is_break, position });
      this.periods.set(await this.staff.schoolPeriods());
      this.newPeriod = { name: '', starts_at: p.ends_at, ends_at: p.ends_at, is_break: false };
      this.notice.set('Period added.');
    });
  }

  protected async deletePeriod(id: string): Promise<void> {
    await this.run(async () => {
      await this.staff.deletePeriod(id);
      this.periods.set(await this.staff.schoolPeriods());
    }, null);
  }

  // ----- admin: read-only grids -----

  protected lessonFor(day: number, periodId: string, filter: { classId?: string; teacherId?: string }): SchoolTimetableRow | undefined {
    return this.schoolLessons().find((l) =>
      l.day_of_week === day && l.period_id === periodId &&
      (!filter.classId || l.class_id === filter.classId) &&
      (!filter.teacherId || l.teacher_id === filter.teacherId));
  }

  protected teacherName(m: StaffMember): string {
    return `${m.first_name} ${m.last_name}`;
  }

  // ----- export -----

  /** Download the teacher's week as a recurring-events .ics file for a phone calendar. */
  protected exportIcs(): void {
    const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Skoolo//Timetable//EN', 'CALSCALE:GREGORIAN'];
    const byday = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    for (const l of this.myLessons()) {
      const start = this.nextDateFor(l.day_of_week, l.starts_at);
      const end = this.nextDateFor(l.day_of_week, l.ends_at);
      if (!start || !end) continue;
      lines.push('BEGIN:VEVENT', `UID:lesson-${l.id}@skoolo`, `DTSTART:${start}`, `DTEND:${end}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${byday[l.day_of_week]}`,
        `SUMMARY:${this.escapeIcs(l.subject_name)} (${this.escapeIcs(l.class_name)})`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    this.download(`timetable-${this.year()}.ics`, lines.join('\r\n'), 'text/calendar');
  }

  /** Local floating datetime (YYYYMMDDTHHMMSS) of the next weekday d from today, at time t. */
  private nextDateFor(d: number, t: string | null): string | null {
    if (!t) return null;
    const now = new Date();
    const today = ((now.getDay() + 6) % 7) + 1;  // JS Sunday=0 -> ISO Monday=1
    const delta = (d - today + 7) % 7;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
    const [hh, mm] = t.split(':');
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}T${hh}${mm}00`;
  }

  private escapeIcs(s: string): string {
    return (s ?? '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  }

  private download(name: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  protected print(): void {
    window.print();
  }

  private async run(action: () => Promise<void>, clearNotice: null | undefined = undefined): Promise<void> {
    this.busy.set(true); this.error.set(null);
    if (clearNotice !== null) this.notice.set(null);
    try { await action(); } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally { this.busy.set(false); }
  }
}
