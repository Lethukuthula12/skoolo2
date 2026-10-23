import type { Database, Enums, Tables, TablesInsert } from './database.types';

export type School = Tables<'schools'>;
export type SchoolDirectoryEntry = Database['public']['Views']['school_directory']['Row'];
export type GradeAvailability = Database['public']['Views']['period_grade_availability']['Row'];
export type Grade = Tables<'grades'>;
export type Profile = Tables<'profiles'>;
export type Learner = Tables<'learners'>;
export type LearnerInsert = TablesInsert<'learners'>;
export type Application = Tables<'applications'>;
export type ApplicationInsert = TablesInsert<'applications'>;
export type ApplicationDocument = Tables<'application_documents'>;
export type Message = Tables<'messages'>;
export type EnrolmentPeriod = Tables<'enrolment_periods'>;
export type PeriodGrade = Tables<'period_grades'>;

export type ApplicationStatus = Enums<'application_status'>;
export type PaymentStatus = Enums<'payment_status'>;
export type DocumentType = Enums<'document_type'>;
export type Province = Enums<'sa_province'>;
export type Gender = Enums<'gender'>;

export const PROVINCES: readonly Province[] = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  more_info_needed: 'More information needed',
  accepted: 'Accepted',
  waitlisted: 'Waitlisted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Awaiting payment',
  marked_paid: 'Payment reported, awaiting confirmation',
  confirmed: 'Payment confirmed',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  birth_certificate: "Learner's birth certificate",
  parent_identity: "Parent or guardian's ID",
  proof_of_address: 'Proof of address',
  latest_report: 'Latest school report',
  immunisation_card: 'Immunisation card',
  other: 'Other',
};

/** Documents every application must include before payment. */
export const REQUIRED_DOCUMENT_TYPES: readonly DocumentType[] = [
  'birth_certificate', 'parent_identity', 'proof_of_address',
];

export type StaffMember = Tables<'staff_members'>;
export type StaffMemberInsert = TablesInsert<'staff_members'>;

export const GUARDIAN_RELATIONSHIPS: readonly string[] = [
  'Mother', 'Father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Legal guardian', 'Other',
];

export const STAFF_POSITIONS: readonly string[] = [
  'Principal', 'Deputy principal', 'Teacher', 'Admin clerk', 'Bursar', 'Receptionist', 'Groundsman',
  'Cleaner', 'Security', 'Driver', 'Cook', 'Other',
];

export type Subject = Tables<'subjects'>;
export type SubjectInsert = TablesInsert<'subjects'>;
export type SchoolClass = Tables<'classes'>;
export type SchoolClassInsert = TablesInsert<'classes'>;
export type ClassSubjectTeacher = Tables<'class_subject_teachers'>;
export type LearnerGuardian = Tables<'learner_guardians'>;
export type LearnerGuardianInsert = TablesInsert<'learner_guardians'>;

export const LANGUAGE_LEVEL_LABELS: Record<string, string> = {
  home: 'Home Language',
  first_additional: 'First Additional Language',
  second_additional: 'Second Additional Language',
};

export type AcademicTerm = Tables<'academic_terms'>;
export type ReportCard = Tables<'report_cards'>;
export type ReportMark = Tables<'report_marks'>;
export type ReportStatus = Enums<'report_status'>;

export const ACHIEVEMENT_LEVELS: { level: number; description: string; band: string }[] = [
  { level: 7, description: 'Outstanding achievement', band: '80–100' },
  { level: 6, description: 'Meritorious achievement', band: '70–79' },
  { level: 5, description: 'Substantial achievement', band: '60–69' },
  { level: 4, description: 'Adequate achievement', band: '50–59' },
  { level: 3, description: 'Moderate achievement', band: '40–49' },
  { level: 2, description: 'Elementary achievement', band: '30–39' },
  { level: 1, description: 'Not achieved', band: '0–29' },
];

export function achievementLevel(mark: number | null): number | null {
  if (mark === null || mark === undefined) return null;
  if (mark >= 80) return 7; if (mark >= 70) return 6; if (mark >= 60) return 5;
  if (mark >= 50) return 4; if (mark >= 40) return 3; if (mark >= 30) return 2;
  return 1;
}

export function achievementDescription(level: number | null): string {
  return ACHIEVEMENT_LEVELS.find((a) => a.level === level)?.description ?? '';
}

export type FeeStructure = Tables<'fee_structures'>;
export type FeeAccount = Tables<'learner_fee_accounts'>;
export type FeePayment = Tables<'fee_payments'>;
export type FeePlan = Enums<'fee_plan'>;
export type FeeBalance = Database['public']['Views']['fee_account_balances']['Row'];

export const FEE_PLAN_LABELS: Record<string, string> = {
  monthly: 'Monthly', term: 'Per term', year: 'Once for the year',
};

export type SchoolPeriod = Tables<'school_periods'>;
export type TimetableLesson = Tables<'timetable_lessons'>;
export type CalendarItem = Tables<'calendar_items'>;
export type CalendarKind = 'test' | 'assignment' | 'outing' | 'event' | 'other';

export const CALENDAR_KIND_LABELS: Record<string, string> = {
  test: 'Test', assignment: 'Assignment', outing: 'Outing', event: 'Event', other: 'Other',
};

export type Assessment = Tables<'assessments'>;
export type AssessmentScore = Tables<'assessment_scores'>;
export type AssessmentKind = 'test' | 'assignment' | 'project' | 'exam' | 'other';

export const ASSESSMENT_KIND_LABELS: Record<string, string> = {
  test: 'Test', assignment: 'Assignment', project: 'Project', exam: 'Exam', other: 'Other',
};

/** Monday-first weekday numbers (ISO) with short and long labels, for the timetable grid. */
export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
];
