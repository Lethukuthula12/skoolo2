import { Injectable, computed, signal } from '@angular/core';
import { injectSupabase } from '../supabase-client';
import type {
  Application, ApplicationDocument, ApplicationStatus, ClassSubjectTeacher, EnrolmentPeriod, Learner,
  LearnerGuardian, LearnerGuardianInsert, LearnerInsert, PeriodGrade, Profile, Province, School, SchoolClass,
  SchoolClassInsert, StaffMember, StaffMemberInsert,
} from '../models';
import type { Database, Tables, TablesInsert, TablesUpdate } from '../database.types';

export type StaffApplication = Application & {
  learner: Learner;
  parent: Pick<Profile, 'id' | 'full_name' | 'phone' | 'email'>;
  period_grade: { id: string; grade_code: string; grades: { label: string; sort_order: number } | null };
  application_documents: ApplicationDocument[];
};

export interface StatusHistoryEntry {
  id: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  note: string | null;
  created_at: string;
}

export type StaffRole = 'admin' | 'staff';
export interface SchoolMembership {
  school: School;
  role: StaffRole;
}

export type ApplicationCounts = Database['public']['Functions']['school_application_counts']['Returns'];
export type GradeAvailabilityRow = Database['public']['Views']['period_grade_availability']['Row'];
export type BankAccount = Tables<'school_bank_accounts'>;
export type StaffInvite = Tables<'staff_invites'>;
export type StaffDocument = Tables<'staff_documents'>;
export type SchoolStaffRow = Tables<'school_staff'> & { profile: Pick<Profile, 'full_name' | 'email' | 'phone'> | null };

export interface NewSchool {
  name: string;
  town: string;
  province: Province;
  phone?: string | null;
  email?: string | null;
  lowestGrade?: string;
  highestGrade?: string;
}

export const STAFF_DOCUMENT_TYPES: readonly string[] = [
  'ID copy', 'Qualification', 'Contract', 'Police clearance', 'SACE certificate', 'CV', 'Other',
];

const APPLICATION_SELECT = `*, learner:learners(*), parent:profiles!applications_parent_id_fkey(id, full_name, phone, email),
  period_grade:period_grades(id, grade_code, grades(label, sort_order)), application_documents(*)`;

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly client = injectSupabase();

  /** Schools the signed-in user belongs to, with their role. Loaded once by the staff guard. */
  readonly memberships = signal<SchoolMembership[]>([]);
  readonly currentSchoolId = signal<string | null>(null);
  readonly loaded = signal(false);

  readonly schools = computed(() => this.memberships().map((m) => m.school));
  readonly currentMembership = computed(
    () => this.memberships().find((m) => m.school.id === this.currentSchoolId()) ?? null,
  );
  readonly currentSchool = computed(() => this.currentMembership()?.school ?? null);
  readonly isAdmin = computed(() => this.currentMembership()?.role === 'admin');

  async loadSchools(): Promise<School[]> {
    // Staff can see their colleagues' rows too, so filter to the signed-in user's own memberships.
    const userId = (await this.client.auth.getSession()).data.session?.user.id;
    if (!userId) {
      this.memberships.set([]);
      this.loaded.set(true);
      return [];
    }
    const { data, error } = await this.client
      .from('school_staff')
      .select('school_id, role, schools(*)')
      .eq('user_id', userId);
    if (error) throw error;
    const memberships = (data ?? [])
      .map((row) => ({ school: row.schools as unknown as School, role: row.role as StaffRole }))
      .filter((m) => !!m.school);
    this.memberships.set(memberships);
    if (!this.currentSchoolId() && memberships.length > 0) {
      this.currentSchoolId.set(memberships[0].school.id);
    }
    this.loaded.set(true);
    return memberships.map((m) => m.school);
  }

  reset(): void {
    this.memberships.set([]);
    this.currentSchoolId.set(null);
    this.loaded.set(false);
  }

  private requireSchoolId(): string {
    const id = this.currentSchoolId();
    if (!id) throw new Error('No school selected');
    return id;
  }

  // ----- Onboarding -----------------------------------------------------------

  async createSchool(input: NewSchool): Promise<School> {
    const { data, error } = await this.client.rpc('create_school', {
      p_name: input.name,
      p_town: input.town,
      p_province: input.province,
      p_phone: input.phone ?? undefined,
      p_email: input.email ?? undefined,
      p_lowest_grade: input.lowestGrade ?? 'GR',
      p_highest_grade: input.highestGrade ?? 'G7',
    });
    if (error) throw error;
    this.reset();
    await this.loadSchools();
    this.currentSchoolId.set(data.id);
    return data;
  }

  async claimSchool(schoolId: string): Promise<School> {
    const { data, error } = await this.client.rpc('claim_school', { p_school_id: schoolId });
    if (error) throw error;
    this.reset();
    await this.loadSchools();
    this.currentSchoolId.set(data.id);
    return data;
  }

  async acceptInvite(code: string): Promise<School> {
    const { data, error } = await this.client.rpc('accept_staff_invite', { p_code: code });
    if (error) throw error;
    this.reset();
    await this.loadSchools();
    this.currentSchoolId.set(data.id);
    return data;
  }

  /** Unclaimed schools matching a name, for the "this is my school" search. */
  async searchUnclaimedSchools(term: string): Promise<School[]> {
    const cleaned = term.trim().replace(/[,()%]/g, '');
    if (cleaned.length < 2) return [];
    const { data, error } = await this.client
      .from('schools')
      .select('*')
      .eq('is_claimed', false)
      .ilike('name', `%${cleaned}%`)
      .order('name')
      .limit(10);
    if (error) throw error;
    return data ?? [];
  }

  // ----- Applications -------------------------------------------------------

  async applications(): Promise<StaffApplication[]> {
    const { data, error } = await this.client
      .from('applications')
      .select(APPLICATION_SELECT)
      .eq('school_id', this.requireSchoolId())
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as StaffApplication[];
  }

  async application(id: string): Promise<StaffApplication | null> {
    const { data, error } = await this.client.from('applications').select(APPLICATION_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data as unknown as StaffApplication | null;
  }

  async counts(): Promise<ApplicationCounts> {
    const { data, error } = await this.client.rpc('school_application_counts', { p_school_id: this.requireSchoolId() });
    if (error) throw error;
    return data ?? [];
  }

  async history(applicationId: string): Promise<StatusHistoryEntry[]> {
    const { data, error } = await this.client
      .from('application_status_history')
      .select('id, from_status, to_status, note, created_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async documentUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.client.storage.from('application-documents').createSignedUrl(storagePath, 60 * 15);
    if (error) throw error;
    return data.signedUrl;
  }

  async confirmPayment(applicationId: string, note?: string): Promise<void> {
    const { error } = await this.client.rpc('confirm_application_payment', {
      p_application_id: applicationId,
      p_note: note ?? undefined,
    });
    if (error) throw error;
  }

  async setStatus(applicationId: string, status: ApplicationStatus, note?: string): Promise<void> {
    const { error } = await this.client.rpc('set_application_status', {
      p_application_id: applicationId,
      p_status: status,
      p_note: note ?? undefined,
    });
    if (error) throw error;
  }

  async sendMessage(application: StaffApplication, subject: string, body: string): Promise<void> {
    const { error } = await this.client.from('messages').insert({
      recipient_id: application.parent_id,
      school_id: application.school_id,
      application_id: application.id,
      subject,
      body,
    });
    if (error) throw error;
  }

  // ----- Enrolment periods --------------------------------------------------

  async periods(): Promise<EnrolmentPeriod[]> {
    const { data, error } = await this.client
      .from('enrolment_periods')
      .select('*')
      .eq('school_id', this.requireSchoolId())
      .order('academic_year', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async createPeriod(period: Omit<TablesInsert<'enrolment_periods'>, 'school_id'>): Promise<EnrolmentPeriod> {
    const { data, error } = await this.client
      .from('enrolment_periods')
      .insert({ ...period, school_id: this.requireSchoolId() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updatePeriod(id: string, changes: TablesUpdate<'enrolment_periods'>): Promise<EnrolmentPeriod> {
    const { data, error } = await this.client.from('enrolment_periods').update(changes).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async gradeAvailability(periodId: string): Promise<GradeAvailabilityRow[]> {
    const { data, error } = await this.client
      .from('period_grade_availability')
      .select('*')
      .eq('period_id', periodId)
      .order('sort_order');
    if (error) throw error;
    return data ?? [];
  }

  async upsertPeriodGrade(row: TablesInsert<'period_grades'>): Promise<PeriodGrade> {
    const { data, error } = await this.client
      .from('period_grades')
      .upsert(row, { onConflict: 'period_id,grade_code' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async removePeriodGrade(id: string): Promise<void> {
    const { error } = await this.client.from('period_grades').delete().eq('id', id);
    if (error) throw error;
  }

  // ----- School profile, badge and bank account -----------------------------

  async updateSchool(changes: TablesUpdate<'schools'>): Promise<School> {
    const { data, error } = await this.client
      .from('schools')
      .update(changes)
      .eq('id', this.requireSchoolId())
      .select()
      .single();
    if (error) throw error;
    this.memberships.update((list) => list.map((m) => (m.school.id === data.id ? { ...m, school: data } : m)));
    return data;
  }

  /** Uploads the badge to the public bucket and points the school at it. Returns the new URL. */
  async uploadBadge(file: File): Promise<string> {
    const schoolId = this.requireSchoolId();
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${schoolId}/badge.${extension}`;
    const { error } = await this.client.storage
      .from('school-badges')
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    const { data } = this.client.storage.from('school-badges').getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    await this.updateSchool({ badge_url: url });
    return url;
  }

  async bankAccount(): Promise<BankAccount | null> {
    const { data, error } = await this.client
      .from('school_bank_accounts')
      .select('*')
      .eq('school_id', this.requireSchoolId())
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async saveBankAccount(account: Omit<TablesInsert<'school_bank_accounts'>, 'school_id'>): Promise<BankAccount> {
    const { data, error } = await this.client
      .from('school_bank_accounts')
      .upsert({ ...account, school_id: this.requireSchoolId() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ----- Staff register, invites and documents -------------------------------

  async staffMembers(): Promise<StaffMember[]> {
    const { data, error } = await this.client
      .from('staff_members')
      .select('*')
      .eq('school_id', this.requireSchoolId())
      .order('last_name')
      .order('first_name');
    if (error) throw error;
    return data ?? [];
  }

  async saveStaffMember(member: Omit<StaffMemberInsert, 'school_id'>): Promise<StaffMember> {
    const { data, error } = await this.client
      .from('staff_members')
      .upsert({ ...member, school_id: this.requireSchoolId() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteStaffMember(id: string): Promise<void> {
    const { error } = await this.client.from('staff_members').delete().eq('id', id);
    if (error) throw error;
  }

  /** People who can sign in to this school's portal. */
  async logins(): Promise<SchoolStaffRow[]> {
    const { data, error } = await this.client
      .from('school_staff')
      .select('*, profile:profiles(full_name, email, phone)')
      .eq('school_id', this.requireSchoolId());
    if (error) throw error;
    return (data ?? []) as unknown as SchoolStaffRow[];
  }

  async removeLogin(userId: string): Promise<void> {
    const { error } = await this.client
      .from('school_staff')
      .delete()
      .eq('school_id', this.requireSchoolId())
      .eq('user_id', userId);
    if (error) throw error;
  }

  async invites(): Promise<StaffInvite[]> {
    const { data, error } = await this.client
      .from('staff_invites')
      .select('*')
      .eq('school_id', this.requireSchoolId())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async createInvite(input: { email: string; fullName: string; role: StaffRole; staffMemberId?: string | null }): Promise<StaffInvite> {
    const { data, error } = await this.client
      .from('staff_invites')
      .insert({
        school_id: this.requireSchoolId(),
        email: input.email,
        full_name: input.fullName,
        role: input.role,
        staff_member_id: input.staffMemberId ?? null,
        code: '',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteInvite(id: string): Promise<void> {
    const { error } = await this.client.from('staff_invites').delete().eq('id', id);
    if (error) throw error;
  }

  async staffDocuments(staffMemberId: string): Promise<StaffDocument[]> {
    const { data, error } = await this.client
      .from('staff_documents')
      .select('*')
      .eq('staff_member_id', staffMemberId)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  async uploadStaffDocument(staffMemberId: string, type: string, file: File): Promise<StaffDocument> {
    const schoolId = this.requireSchoolId();
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const path = `${schoolId}/${staffMemberId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await this.client.storage
      .from('staff-documents')
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    const { data, error } = await this.client
      .from('staff_documents')
      .insert({
        school_id: schoolId,
        staff_member_id: staffMemberId,
        document_type: type,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async staffDocumentUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.client.storage.from('staff-documents').createSignedUrl(storagePath, 60 * 15);
    if (error) throw error;
    return data.signedUrl;
  }

  async deleteStaffDocument(doc: StaffDocument): Promise<void> {
    await this.client.storage.from('staff-documents').remove([doc.storage_path]);
    const { error } = await this.client.from('staff_documents').delete().eq('id', doc.id);
    if (error) throw error;
  }

  // ----- Subjects ------------------------------------------------------------

  async subjects(): Promise<Tables<'subjects'>[]> {
    const { data, error } = await this.client
      .from('subjects')
      .select('*')
      .eq('school_id', this.requireSchoolId())
      .order('sort_order');
    if (error) throw error;
    return data ?? [];
  }

  async saveSubject(subject: Omit<TablesInsert<'subjects'>, 'school_id'> & { id?: string }): Promise<Tables<'subjects'>> {
    const row = { ...subject, school_id: this.requireSchoolId() };
    const { data, error } = await this.client.from('subjects').upsert(row).select().single();
    if (error) throw error;
    return data;
  }

  async deleteSubject(id: string): Promise<void> {
    const { error } = await this.client.from('subjects').delete().eq('id', id);
    if (error) throw error;
  }

  /** Offer the CAPS defaults for every grade in the school's range. Returns how many were added. */
  async seedDefaultSubjects(): Promise<number> {
    const { data, error } = await this.client.rpc('seed_default_subjects', { p_school_id: this.requireSchoolId() });
    if (error) throw error;
    return data ?? 0;
  }

  // ----- Classes and teaching assignments ------------------------------------

  async classes(year?: number): Promise<ClassRow[]> {
    let query = this.client
      .from('classes')
      .select('*, grades(label, sort_order), class_teacher:staff_members(first_name, last_name)')
      .eq('school_id', this.requireSchoolId())
      .order('academic_year', { ascending: false });
    if (year) query = query.eq('academic_year', year);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as ClassRow[];
  }

  async saveClass(cls: Omit<SchoolClassInsert, 'school_id'> & { id?: string }): Promise<SchoolClass> {
    const row = { ...cls, school_id: this.requireSchoolId() };
    const { data, error } = await this.client.from('classes').upsert(row).select().single();
    if (error) throw error;
    return data;
  }

  async deleteClass(id: string): Promise<void> {
    const { error } = await this.client.from('classes').delete().eq('id', id);
    if (error) throw error;
  }

  async classSubjectTeachers(classId: string): Promise<ClassSubjectTeacherRow[]> {
    const { data, error } = await this.client
      .from('class_subject_teachers')
      .select('*, subjects(name, grade_code), teacher:staff_members(first_name, last_name)')
      .eq('class_id', classId);
    if (error) throw error;
    return (data ?? []) as unknown as ClassSubjectTeacherRow[];
  }

  async assignSubjectTeacher(classId: string, subjectId: string, teacherId: string | null): Promise<void> {
    const { error } = await this.client
      .from('class_subject_teachers')
      .upsert({ class_id: classId, subject_id: subjectId, teacher_id: teacherId }, { onConflict: 'class_id,subject_id' });
    if (error) throw error;
  }

  // ----- Learner register ----------------------------------------------------

  async schoolLearners(): Promise<RegisterLearnerRow[]> {
    const { data, error } = await this.client
      .from('learners')
      .select('*, classes(name, grade_code)')
      .eq('school_id', this.requireSchoolId())
      .order('last_name')
      .order('first_name');
    if (error) throw error;
    return (data ?? []) as unknown as RegisterLearnerRow[];
  }

  async saveLearner(learner: Omit<LearnerInsert, 'school_id'> & { id?: string }): Promise<Learner> {
    const row = { ...learner, school_id: this.requireSchoolId() };
    const { data, error } = await this.client.from('learners').upsert(row).select().single();
    if (error) throw error;
    return data;
  }

  async moveLearner(id: string, classId: string | null): Promise<void> {
    const { error } = await this.client.from('learners').update({ current_class_id: classId }).eq('id', id);
    if (error) throw error;
  }

  async deleteLearner(id: string): Promise<void> {
    const { error } = await this.client.from('learners').delete().eq('id', id);
    if (error) throw error;
  }

  /** Bulk-insert validated learner rows into a class. Returns how many were saved. */
  async importLearners(classId: string, rows: LearnerInsert[]): Promise<number> {
    const schoolId = this.requireSchoolId();
    const prepared = rows.map((r) => ({ ...r, school_id: schoolId, current_class_id: classId }));
    const { data, error } = await this.client.from('learners').insert(prepared).select('id');
    if (error) throw error;
    return data?.length ?? 0;
  }

  async guardians(learnerId: string): Promise<LearnerGuardian[]> {
    const { data, error } = await this.client
      .from('learner_guardians')
      .select('*')
      .eq('learner_id', learnerId)
      .order('is_primary', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async saveGuardian(guardian: LearnerGuardianInsert & { id?: string }): Promise<LearnerGuardian> {
    const { data, error } = await this.client.from('learner_guardians').upsert(guardian).select().single();
    if (error) throw error;
    return data;
  }

  async deleteGuardian(id: string): Promise<void> {
    const { error } = await this.client.from('learner_guardians').delete().eq('id', id);
    if (error) throw error;
  }

  // ----- Teacher's own classes ----------------------------------------------

  /** The classes the signed-in teacher teaches (class teacher or subject teacher). */
  async myClasses(): Promise<MyClass[]> {
    const { data, error } = await this.client.rpc('my_classes');
    if (error) throw error;
    return (data ?? []) as MyClass[];
  }

  /** Learners in one class. Row security limits a teacher to classes they teach. */
  async classLearners(classId: string): Promise<Learner[]> {
    const { data, error } = await this.client
      .from('learners')
      .select('*')
      .eq('current_class_id', classId)
      .order('last_name')
      .order('first_name');
    if (error) throw error;
    return data ?? [];
  }
}

export interface MyClass {
  id: string;
  school_id: string;
  academic_year: number;
  grade_code: string;
  name: string;
  is_class_teacher: boolean;
}

export type ClassRow = SchoolClass & {
  grades: { label: string; sort_order: number } | null;
  class_teacher: { first_name: string; last_name: string } | null;
};
export type ClassSubjectTeacherRow = ClassSubjectTeacher & {
  subjects: { name: string; grade_code: string } | null;
  teacher: { first_name: string; last_name: string } | null;
};
export type RegisterLearnerRow = Learner & {
  classes: { name: string; grade_code: string } | null;
};
