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
