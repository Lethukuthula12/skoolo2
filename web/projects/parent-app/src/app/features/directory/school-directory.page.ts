import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonAvatar, IonBadge, IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonItem,
  IonLabel, IonList, IonSearchbar, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import type { SearchbarCustomEvent } from '@ionic/angular/standalone';
import {
  AuthService, Grade, GradeAvailability, SchoolDirectoryEntry, SchoolDirectoryService,
} from '@skoolo/shared';
import { InstallHintComponent } from './install-hint.component';

type RegistrationState = 'open' | 'closed' | 'not_listed';

@Component({
  selector: 'app-school-directory-page',
  imports: [
    CurrencyPipe, DatePipe, RouterLink, InstallHintComponent,
    IonAvatar, IonBadge, IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonItem,
    IonLabel, IonList, IonSearchbar, IonSpinner, IonTitle, IonToolbar,
  ],
  templateUrl: './school-directory.page.html',
  styleUrl: './school-directory.page.scss',
})
export class SchoolDirectoryPage {
  private readonly directory = inject(SchoolDirectoryService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly term = signal('');
  protected readonly schools = signal<SchoolDirectoryEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly gradeAvailability = signal<GradeAvailability[]>([]);
  protected readonly gradesLoading = signal(false);
  private readonly gradeLabels = signal<Record<string, string>>({});

  protected readonly selectedSchool = computed(
    () => this.schools().find((s) => s.id === this.selectedId()) ?? null,
  );

  constructor() {
    void this.loadGrades();
    void this.load('');
  }

  protected onSearch(event: SearchbarCustomEvent): void {
    const value = event.detail.value ?? '';
    this.term.set(value);
    void this.load(value);
  }

  protected async toggle(school: SchoolDirectoryEntry): Promise<void> {
    if (this.selectedId() === school.id) {
      this.selectedId.set(null);
      return;
    }
    this.selectedId.set(school.id);
    this.gradeAvailability.set([]);
    if (school.open_period_id) {
      this.gradesLoading.set(true);
      try {
        this.gradeAvailability.set(await this.directory.gradeAvailability(school.open_period_id));
      } finally {
        this.gradesLoading.set(false);
      }
    }
  }

  protected registrationState(school: SchoolDirectoryEntry): RegistrationState {
    if (school.is_open_for_registration) return 'open';
    return school.is_claimed ? 'closed' : 'not_listed';
  }

  protected statusLabel(school: SchoolDirectoryEntry): string {
    switch (this.registrationState(school)) {
      case 'open': return 'Open';
      case 'closed': return 'Closed';
      default: return 'Coming soon';
    }
  }

  protected statusColor(school: SchoolDirectoryEntry): string {
    switch (this.registrationState(school)) {
      case 'open': return 'success';
      case 'closed': return 'medium';
      default: return 'light';
    }
  }

  protected gradeRange(school: SchoolDirectoryEntry): string {
    const labels = this.gradeLabels();
    const lowest = school.lowest_grade ? labels[school.lowest_grade] : null;
    const highest = school.highest_grade ? labels[school.highest_grade] : null;
    if (lowest && highest) return `${lowest} to ${highest}`;
    return lowest ?? highest ?? '';
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter((part) => /^[A-Za-z]/.test(part))
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  protected avatarHue(name: string): number {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return hash;
  }

  protected placesLabel(grade: GradeAvailability): string {
    if (!grade.is_available) return 'Full';
    if (grade.places_left === null || grade.places_left === undefined) return 'Open';
    return `${grade.places_left} left`;
  }

  protected register(school: SchoolDirectoryEntry): void {
    const target = `/apply/${school.slug}`;
    if (this.auth.isSignedIn()) {
      void this.router.navigateByUrl(target);
    } else {
      void this.router.navigate(['/auth'], { queryParams: { returnUrl: target } });
    }
  }

  private async load(term: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const results = await this.directory.search(term);
      // Ignore stale responses from an earlier keystroke.
      if (this.term() === term) {
        this.schools.set(results);
      }
    } catch (error) {
      this.loadError.set('Could not load schools. Check your connection and try again.');
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadGrades(): Promise<void> {
    const grades: Grade[] = await this.directory.grades();
    this.gradeLabels.set(Object.fromEntries(grades.map((g) => [g.code, g.label])));
  }
}
