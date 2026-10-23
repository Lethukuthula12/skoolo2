import { Component, effect, inject, input, signal } from '@angular/core';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import {
  ACHIEVEMENT_LEVELS, ApplicationService, ChildReport, achievementDescription, achievementLevel,
} from '@skoolo/shared';

@Component({
  selector: 'app-child-reports-page',
  imports: [
    IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/children" text="" /></ion-buttons>
        <ion-title>Reports</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (loading()) {
        <div class="centered"><ion-spinner name="crescent" /></div>
      } @else if (reports().length === 0) {
        <div class="centered">
          <ion-icon name="document-text-outline" size="large" />
          <p>No reports have been published for this child yet. You will get a message when one is ready.</p>
        </div>
      } @else {
        @for (r of reports(); track r.id) {
          <article class="form-card report">
            <header (click)="toggle(r.id)">
              <div>
                <h2>Term {{ r.term_number }} · {{ r.academic_year }}</h2>
                <p>{{ r.schools?.name }}@if (r.classes) { · {{ r.classes.grade_code }} {{ r.classes.name }} }</p>
              </div>
              <ion-icon [name]="open() === r.id ? 'chevron-up-outline' : 'chevron-down-outline'" />
            </header>

            @if (open() === r.id) {
              <table class="marks">
                <thead><tr><th>Subject</th><th>%</th><th>Level</th></tr></thead>
                <tbody>
                  @for (m of sortedMarks(r); track m.subjects?.name) {
                    <tr>
                      <td>{{ m.subjects?.name }}</td>
                      <td class="c">{{ m.mark ?? '—' }}</td>
                      <td class="c">{{ level(m.mark) ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (r.days_absent) { <p class="meta">Days absent: {{ r.days_absent }}</p> }
              @if (r.teacher_comment) { <p class="comment"><strong>Teacher:</strong> {{ r.teacher_comment }}</p> }
              @if (r.principal_comment) { <p class="comment"><strong>Principal:</strong> {{ r.principal_comment }}</p> }
              <details class="legend">
                <summary>How to read the levels</summary>
                <ul>
                  @for (l of levels; track l.level) { <li><strong>{{ l.level }}</strong> {{ l.description }} ({{ l.band }}%)</li> }
                </ul>
              </details>
            }
          </article>
        }
      }
    </ion-content>
  `,
  styles: `
    .report { padding: 0; overflow: hidden; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; }
    h2 { margin: 0; font-size: 1.05rem; font-weight: 700; }
    header p { margin: 2px 0 0; color: var(--skoolo-muted); font-size: 0.88rem; }
    table.marks { width: 100%; border-collapse: collapse; }
    table.marks th, table.marks td { border-top: 1px solid var(--skoolo-line); padding: 8px 16px; text-align: left; font-size: 0.92rem; }
    table.marks th { background: var(--skoolo-surface-2); font-size: 0.78rem; color: var(--ion-color-medium); }
    .c { text-align: center; }
    .meta, .comment { padding: 4px 16px; margin: 0; font-size: 0.9rem; }
    .legend { padding: 8px 16px 14px; font-size: 0.85rem; }
    .legend ul { margin: 6px 0 0; padding-left: 18px; }
  `,
})
export class ChildReportsPage {
  readonly learnerId = input.required<string>();
  private readonly applications = inject(ApplicationService);

  protected readonly levels = ACHIEVEMENT_LEVELS;
  protected readonly reports = signal<ChildReport[]>([]);
  protected readonly loading = signal(true);
  protected readonly open = signal<string | null>(null);

  constructor() {
    effect(() => {
      void this.load(this.learnerId());
    });
  }

  protected level(mark: number | null): number | null {
    return achievementLevel(mark);
  }

  protected description(mark: number | null): string {
    return achievementDescription(achievementLevel(mark));
  }

  protected sortedMarks(r: ChildReport) {
    return [...r.report_marks].sort((a, b) => (a.subjects?.sort_order ?? 0) - (b.subjects?.sort_order ?? 0));
  }

  protected toggle(id: string): void {
    this.open.set(this.open() === id ? null : id);
  }

  private async load(learnerId: string): Promise<void> {
    this.loading.set(true);
    try {
      const reports = await this.applications.childReports(learnerId);
      this.reports.set(reports);
      if (reports.length > 0) this.open.set(reports[0].id);
    } finally {
      this.loading.set(false);
    }
  }
}
