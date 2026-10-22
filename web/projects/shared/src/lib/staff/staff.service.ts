import { Injectable, computed, signal } from '@angular/core';
import { injectSupabase } from '../supabase-client';
import type {
  Application, ApplicationDocument, ApplicationStatus, EnrolmentPeriod, Learner, PeriodGrade, Profile, School,
  StaffMember, StaffMemberInsert,
} from '../models';
import type { Database, TablesInsert, TablesUpdate } from '../database.types';

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

export type ApplicationCounts = Database['public']['Functions']['school_application_counts']['Returns'];
export type GradeAvailabilityRow = Database['public']['Views']['period_grade_availability']['Row'];
export type BankAccount = Database['public']['Tables']['school_bank_accounts']['Row'];

const APPLICATION_SELECT = `*, learner:learners(*), parent:profiles!applications_parent_id_fkey(id, full_name, phone, email),
  period_grade:period_grades(id, grade_code, grades(label, sort_order)), application_documents(*)`;

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly client = injectSupabase();

  /** Schools the signed-in user administers. Loaded once by the staff guard. */
  readonly schools = signal<School[]>([]);
  readonly currentSchoolId = signal<string | null>(null);
  readonly currentSchool = computed(() => this.schools().find((s) => s.id === this.currentSchoolId()) ?? null);
  readonly loaded = signal(false);

  async loadSchools(): Promise<School[]> {
    const { data, error } = await this.client.from('school_staff').select('school_id, schools(*)');
    if (error) throw error;
    const schools = (data ?? []).map((row) => row.schools as unknown as School).filter(Boolean);
    this.schools.set(schools);
    if (!this.currentSchoolId() && schools.length > 0) {
      this.currentSchoolId.set(schools[0].id);
    }
    this.loaded.set(true);
    return schools;
  }

  reset(): void {
    this.schools.set([]);
    this.currentSchoolId.set(null);
    this.loaded.set(false);
  }

  private requireSchoolId(): string {
    const id = this.currentSchoolId();
    if (!id) throw new Error('No school selected');
    return id;
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

  // ----- School profile and bank account -----------------------------------

  async updateSchool(changes: TablesUpdate<'schools'>): Promise<School> {
    const { data, error } = await this.client
      .from('schools')
      .update(changes)
      .eq('id', this.requireSchoolId())
      .select()
      .single();
    if (error) throw error;
    this.schools.update((list) => list.map((s) => (s.id === data.id ? data : s)));
    return data;
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

  // ----- Staff register ------------------------------------------------------

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
}
