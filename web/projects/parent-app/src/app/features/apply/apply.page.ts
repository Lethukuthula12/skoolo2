import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon, IonInput,
  IonItem, IonLabel, IonList, IonNote, IonProgressBar, IonRadio, IonRadioGroup, IonSelect,
  IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import {
  ApplicationError, ApplicationService, GradeAvailability, PROVINCES, Province, SchoolDirectoryEntry,
  SchoolDirectoryService, dateOfBirthFromIdentityNumber, genderFromIdentityNumber, saIdentityNumberValidator,
} from '@skoolo/shared';

type Step = 'learner' | 'address' | 'review';
const STEPS: Step[] = ['learner', 'address', 'review'];

@Component({
  selector: 'app-apply-page',
  imports: [
    CurrencyPipe, ReactiveFormsModule,
    IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon, IonInput,
    IonItem, IonLabel, IonList, IonNote, IonProgressBar, IonRadio, IonRadioGroup, IonSelect,
    IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar,
  ],
  templateUrl: './apply.page.html',
  styleUrl: './apply.page.scss',
})
export class ApplyPage {
  readonly slug = input.required<string>();

  private readonly directory = inject(SchoolDirectoryService);
  private readonly applications = inject(ApplicationService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  protected readonly provinces = PROVINCES;
  protected readonly school = signal<SchoolDirectoryEntry | null>(null);
  protected readonly grades = signal<GradeAvailability[]>([]);
  protected readonly loading = signal(true);
  protected readonly step = signal<Step>('learner');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly stepIndex = computed(() => STEPS.indexOf(this.step()));
  protected readonly progress = computed(() => (this.stepIndex() + 1) / STEPS.length);
  protected readonly isOpen = computed(() => this.school()?.is_open_for_registration === true);

  protected readonly learnerForm = this.formBuilder.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    identityType: ['sa_id' as 'sa_id' | 'passport', Validators.required],
    identityNumber: ['', [saIdentityNumberValidator]],
    passportNumber: [''],
    dateOfBirth: ['', Validators.required],
    gender: ['unspecified' as 'female' | 'male' | 'unspecified', Validators.required],
    nationality: ['South African', Validators.required],
    homeLanguage: [''],
    previousSchool: [''],
    periodGradeId: ['', Validators.required],
  });

  protected readonly addressForm = this.formBuilder.group({
    addressLine: ['', Validators.required],
    suburb: [''],
    town: ['', Validators.required],
    province: ['' as Province | '', Validators.required],
    postalCode: ['', [Validators.pattern(/^\d{4}$/)]],
    usesTransport: ['' as '' | 'yes' | 'no'],
    transportProvider: [''],
    parentNote: [''],
  });

  protected readonly consent = signal(false);

  constructor() {
    effect(() => {
      const slug = this.slug();
      void this.load(slug);
    });

    // Keep the identity fields honest for the chosen identity type.
    this.learnerForm.controls.identityType.valueChanges.subscribe((type) => {
      const id = this.learnerForm.controls.identityNumber;
      const passport = this.learnerForm.controls.passportNumber;
      if (type === 'sa_id') {
        id.setValidators([Validators.required, saIdentityNumberValidator]);
        passport.clearValidators();
        passport.setValue('');
      } else {
        passport.setValidators([Validators.required, Validators.minLength(5)]);
        id.clearValidators();
        id.setValue('');
      }
      id.updateValueAndValidity();
      passport.updateValueAndValidity();
    });
    this.learnerForm.controls.identityType.setValue('sa_id');

    // A valid ID number tells us the birth date and sex: prefill, parent can still change them.
    this.learnerForm.controls.identityNumber.valueChanges.subscribe((value) => {
      const dob = dateOfBirthFromIdentityNumber(value);
      if (dob && !this.learnerForm.controls.dateOfBirth.value) {
        this.learnerForm.controls.dateOfBirth.setValue(dob);
      }
      const gender = genderFromIdentityNumber(value);
      if (gender && this.learnerForm.controls.gender.value === 'unspecified') {
        this.learnerForm.controls.gender.setValue(gender);
      }
    });
  }

  protected selectedGrade(): GradeAvailability | undefined {
    return this.grades().find((g) => g.id === this.learnerForm.controls.periodGradeId.value);
  }

  protected gradeOptionLabel(grade: GradeAvailability): string {
    if (!grade.is_available) return `${grade.grade_label} (full)`;
    if (grade.places_left === null || grade.places_left === undefined) return grade.grade_label ?? '';
    return `${grade.grade_label} (${grade.places_left} places left)`;
  }

  protected next(): void {
    this.submitError.set(null);
    if (this.step() === 'learner') {
      this.learnerForm.markAllAsTouched();
      if (this.learnerForm.invalid) return;
      this.step.set('address');
    } else if (this.step() === 'address') {
      this.addressForm.markAllAsTouched();
      if (this.addressForm.invalid) return;
      this.step.set('review');
    }
  }

  protected back(): void {
    this.submitError.set(null);
    const index = this.stepIndex();
    if (index > 0) this.step.set(STEPS[index - 1]);
  }

  protected async submit(): Promise<void> {
    if (!this.consent() || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    const learner = this.learnerForm.getRawValue();
    const address = this.addressForm.getRawValue();
    try {
      const application = await this.applications.submit({
        learner: {
          first_name: learner.firstName.trim(),
          last_name: learner.lastName.trim(),
          date_of_birth: learner.dateOfBirth,
          gender: learner.gender,
          identity_number: learner.identityType === 'sa_id' ? learner.identityNumber.trim() : null,
          passport_number: learner.identityType === 'passport' ? learner.passportNumber.trim() : null,
          nationality: learner.nationality.trim() || 'South African',
          home_language: learner.homeLanguage.trim() || null,
          previous_school: learner.previousSchool.trim() || null,
        },
        periodGradeId: learner.periodGradeId,
        address: {
          address_line: address.addressLine.trim(),
          suburb: address.suburb.trim(),
          town: address.town.trim(),
          province: address.province as Province,
          postal_code: address.postalCode.trim(),
        },
        usesSchoolTransport: address.usesTransport === '' ? null : address.usesTransport === 'yes',
        transportProviderName: address.usesTransport === 'yes' ? address.transportProvider.trim() || null : null,
        parentNote: address.parentNote.trim() || null,
      });
      await this.router.navigate(['/applications', application.id, 'documents'], { replaceUrl: true });
    } catch (error) {
      const message = error instanceof ApplicationError ? error.message : 'Something went wrong. Please try again.';
      this.submitError.set(message);
      if (error instanceof ApplicationError && (error.hint === 'GRADE_FULL' || error.hint === 'GRADE_CLOSED')) {
        // Refresh availability so the dropdown reflects what just happened.
        const periodId = this.school()?.open_period_id;
        if (periodId) this.grades.set(await this.directory.gradeAvailability(periodId));
        this.step.set('learner');
      }
      console.error(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    try {
      const school = await this.directory.bySlug(slug);
      this.school.set(school);
      if (school?.open_period_id) {
        this.grades.set(await this.directory.gradeAvailability(school.open_period_id));
      }
    } finally {
      this.loading.set(false);
    }
  }
}
