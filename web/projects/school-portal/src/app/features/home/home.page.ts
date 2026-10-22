import { Component, computed, inject, signal } from '@angular/core';
import { AuthService, Grade, Learner, MyClass, SchoolDirectoryService, StaffService } from '@skoolo/shared';

/** The teacher's home: the classes they teach and the learners in them. Read-only. */
@Component({
  selector: 'app-home-page',
  template: `
    <div class="stack">
      <div>
        <h1>Welcome, {{ name() }}</h1>
        <p class="muted">{{ staff.currentSchool()?.name }}</p>
      </div>

      @if (notice()) { <p class="ok">{{ notice() }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }

      @if (loading()) {
        <p class="muted">Loading your classes…</p>
      } @else if (classes().length === 0) {
        <div class="card">
          <h2>No classes assigned to you yet</h2>
          <p class="muted">
            When your school's administrator makes you a class teacher or a subject teacher, your classes and
            learners appear here. Your marks, timetable and messages will follow as those features are added.
          </p>
        </div>
      } @else {
        <div class="class-cards">
          @for (c of classes(); track c.id) {
            <button class="class-card" type="button" [class.active]="selectedId() === c.id" (click)="select(c)">
              <div class="row">
                <strong>{{ gradeLabel(c.grade_code) }} {{ c.name }}</strong>
                <span class="badge" [class.badge-success]="c.is_class_teacher">{{ c.is_class_teacher ? 'Class teacher' : 'Subject teacher' }}</span>
              </div>
              <div class="muted small">{{ count(c.id) }} learners · {{ c.academic_year }}</div>
            </button>
          }
        </div>

        @if (selected(); as c) {
          <div class="card stack">
            <h2>{{ gradeLabel(c.grade_code) }} {{ c.name }}</h2>
            @if (roster().length === 0) {
              <p class="muted">No learners in this class yet.</p>
            } @else {
              <div class="table-wrap">
                <table class="data">
                  <thead><tr><th>#</th><th>Surname, first name</th><th>Date of birth</th><th>Age</th><th>Gender</th></tr></thead>
                  <tbody>
                    @for (l of roster(); track l.id; let i = $index) {
                      <tr>
                        <td>{{ i + 1 }}</td>
                        <td><strong>{{ l.last_name }}, {{ l.first_name }}</strong></td>
                        <td>{{ l.date_of_birth }}</td>
                        <td>{{ age(l.date_of_birth) }}</td>
                        <td>{{ l.gender }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .class-cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); }
    .class-card {
      background: #fff; border: 2px solid var(--line); border-radius: var(--radius); padding: 14px 16px;
      text-align: left; font: inherit; cursor: pointer; display: grid; gap: 6px;
      &.active { border-color: var(--brand); }
      .row { justify-content: space-between; }
    }
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  protected readonly staff = inject(StaffService);
  private readonly directory = inject(SchoolDirectoryService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly classes = signal<MyClass[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly roster = signal<Learner[]>([]);
  private readonly grades = signal<Grade[]>([]);
  private readonly counts = signal<Record<string, number>>({});

  protected readonly selected = computed(() => this.classes().find((c) => c.id === this.selectedId()) ?? null);

  constructor() {
    void this.load();
  }

  protected name(): string {
    const meta = this.auth.user()?.user_metadata ?? {};
    return (meta['full_name'] as string | undefined) || this.auth.user()?.email || 'there';
  }

  protected gradeLabel(code: string): string {
    return this.grades().find((g) => g.code === code)?.label ?? code;
  }

  protected count(classId: string): number {
    return this.counts()[classId] ?? 0;
  }

  protected age(dob: string): number {
    const d = new Date(dob);
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
    return a;
  }

  protected async select(c: MyClass): Promise<void> {
    this.selectedId.set(c.id);
    this.roster.set(await this.staff.classLearners(c.id));
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [grades, classes] = await Promise.all([this.directory.grades(), this.staff.myClasses()]);
      this.grades.set(grades);
      this.classes.set(classes);
      // Learner counts per class, fetched in parallel (a teacher has only a handful of classes).
      const rosters = await Promise.all(classes.map((c) => this.staff.classLearners(c.id)));
      const counts: Record<string, number> = {};
      classes.forEach((c, i) => (counts[c.id] = rosters[i].length));
      this.counts.set(counts);
      if (classes.length > 0) await this.select(classes[0]);
    } catch (err) {
      console.error(err);
      this.error.set('Could not load your classes.');
    } finally {
      this.loading.set(false);
    }
  }
}
