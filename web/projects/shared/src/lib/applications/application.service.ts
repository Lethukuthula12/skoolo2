import { Injectable } from '@angular/core';
import { injectSupabase } from '../supabase-client';
import type {
  Application, ApplicationDocument, ApplicationInsert, DocumentType, Learner, LearnerInsert, Message,
} from '../models';
import type { Database } from '../database.types';

export type PaymentInstructions =
  Database['public']['Functions']['get_payment_instructions']['Returns'][number];

/** An application joined with the rows the parent app shows alongside it. */
export interface ApplicationSummary extends Application {
  learner: Pick<Learner, 'first_name' | 'last_name'>;
  school: { name: string; slug: string; badge_url: string | null };
  period_grade: { grade_code: string; grades: { label: string } | null };
}

export interface NewApplication {
  learner: Omit<LearnerInsert, 'parent_id'>;
  periodGradeId: string;
  address: Pick<ApplicationInsert, 'address_line' | 'suburb' | 'town' | 'province' | 'postal_code'>;
  usesSchoolTransport: boolean | null;
  transportProviderName: string | null;
  parentNote: string | null;
  guardian: { fullName: string; relationship: string; identityNumber: string; phone: string };
}

/** Error hints raised by the database triggers, surfaced for friendly messages. */
export type ApplicationErrorHint =
  | 'GRADE_FULL' | 'GRADE_CLOSED' | 'PERIOD_CLOSED' | 'LEARNER_NOT_OWNED' | 'DUPLICATE' | 'UNKNOWN';

export class ApplicationError extends Error {
  constructor(readonly hint: ApplicationErrorHint, message: string) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly client = injectSupabase();

  /** Creates the learner, then the application. The database holds the place or rejects it. */
  async submit(input: NewApplication): Promise<Application> {
    const userId = (await this.client.auth.getUser()).data.user?.id;
    if (!userId) throw new ApplicationError('UNKNOWN', 'You need to be signed in.');

    const { data: learner, error: learnerError } = await this.client
      .from('learners')
      .insert({ ...input.learner, parent_id: userId })
      .select()
      .single();
    if (learnerError) throw this.translate(learnerError);

    const { data: application, error } = await this.client
      .from('applications')
      .insert({
        learner_id: learner.id,
        period_grade_id: input.periodGradeId,
        // school_id, period_id, parent_id and payment_reference are set by the insert trigger;
        // placeholders satisfy the column types only.
        school_id: '00000000-0000-0000-0000-000000000000',
        period_id: '00000000-0000-0000-0000-000000000000',
        parent_id: userId,
        payment_reference: '',
        ...input.address,
        uses_school_transport: input.usesSchoolTransport,
        transport_provider_name: input.transportProviderName,
        parent_note: input.parentNote,
        guardian_full_name: input.guardian.fullName,
        guardian_relationship: input.guardian.relationship,
        guardian_identity_number: input.guardian.identityNumber || null,
        guardian_phone: input.guardian.phone,
      })
      .select()
      .single();
    if (error) {
      // Do not leave an orphan learner behind when the application is refused.
      await this.client.from('learners').delete().eq('id', learner.id);
      throw this.translate(error);
    }
    return application;
  }

  async mine(): Promise<ApplicationSummary[]> {
    const { data, error } = await this.client
      .from('applications')
      .select(`*, learner:learners(first_name, last_name), school:schools(name, slug, badge_url),
               period_grade:period_grades(grade_code, grades(label))`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ApplicationSummary[];
  }

  async byId(id: string): Promise<ApplicationSummary | null> {
    const { data, error } = await this.client
      .from('applications')
      .select(`*, learner:learners(first_name, last_name), school:schools(name, slug, badge_url),
               period_grade:period_grades(grade_code, grades(label))`)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as ApplicationSummary | null;
  }

  async documents(applicationId: string): Promise<ApplicationDocument[]> {
    const { data, error } = await this.client
      .from('application_documents')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  /** Uploads the file to the private bucket and records it. Replaces an earlier file of the same type. */
  async uploadDocument(applicationId: string, type: DocumentType, file: File): Promise<ApplicationDocument> {
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const path = `${applicationId}/${type}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await this.client.storage
      .from('application-documents')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const existing = (await this.documents(applicationId)).filter((d) => d.document_type === type);
    for (const doc of existing) {
      await this.client.from('application_documents').delete().eq('id', doc.id);
      await this.client.storage.from('application-documents').remove([doc.storage_path]);
    }

    const { data, error } = await this.client
      .from('application_documents')
      .insert({
        application_id: applicationId,
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

  async documentUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from('application-documents')
      .createSignedUrl(storagePath, 60 * 10);
    if (error) throw error;
    return data.signedUrl;
  }

  async paymentInstructions(applicationId: string): Promise<PaymentInstructions | null> {
    const { data, error } = await this.client.rpc('get_payment_instructions', { p_application_id: applicationId });
    if (error) throw error;
    return data?.[0] ?? null;
  }

  async markPaid(applicationId: string): Promise<void> {
    const { error } = await this.client.rpc('mark_application_paid', { p_application_id: applicationId });
    if (error) throw error;
  }

  async withdraw(applicationId: string): Promise<void> {
    const { error } = await this.client.rpc('withdraw_application', { p_application_id: applicationId });
    if (error) throw error;
  }

  async messages(): Promise<Message[]> {
    const { data, error } = await this.client.from('messages').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async unreadCount(): Promise<number> {
    const { count, error } = await this.client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  }

  async markMessageRead(id: string): Promise<void> {
    const { error } = await this.client.from('messages').update({ is_read: true }).eq('id', id);
    if (error) throw error;
  }

  /** The children this parent is connected to (applicant or linked by family code). */
  async myChildren(): Promise<MyChild[]> {
    const { data, error } = await this.client.rpc('my_children');
    if (error) throw error;
    return (data ?? []) as MyChild[];
  }

  /** A child's published reports, newest first. Row security returns only published ones. */
  async childReports(learnerId: string): Promise<ChildReport[]> {
    const { data, error } = await this.client
      .from('report_cards')
      .select(`*, report_marks(*, subjects(name, sort_order, language_level)),
               classes(name, grade_code), schools:school_id(name, stamp_url)`)
      .eq('learner_id', learnerId)
      .eq('status', 'published')
      .order('academic_year', { ascending: false })
      .order('term_number', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ChildReport[];
  }

  /** Redeem a family code to connect to a child. Returns the child, or throws a friendly message. */
  async redeemFamilyCode(code: string, relationship?: string): Promise<{ first_name: string; last_name: string; school_name: string }> {
    const { data, error } = await this.client.rpc('redeem_family_code', {
      p_code: code.trim().toUpperCase(),
      p_relationship: relationship ?? '',
    });
    if (error) {
      const hint = (error as { hint?: string }).hint;
      if (hint === 'CODE_NOT_FOUND') throw new Error('That code was not found. Check it with your school and try again.');
      throw new Error(error.message);
    }
    const row = data?.[0];
    if (!row) throw new Error('That code was not found. Check it with your school and try again.');
    return { first_name: row.first_name, last_name: row.last_name, school_name: row.school_name };
  }

  private translate(error: { message: string; hint?: string | null; code?: string }): ApplicationError {
    const hint = (error.hint ?? '') as ApplicationErrorHint;
    switch (hint) {
      case 'GRADE_FULL':
        return new ApplicationError(hint, 'That grade has just filled up. Please choose another grade or contact the school.');
      case 'GRADE_CLOSED':
        return new ApplicationError(hint, 'That grade is not accepting applications.');
      case 'PERIOD_CLOSED':
        return new ApplicationError(hint, 'Enrolment at this school is closed.');
      case 'LEARNER_NOT_OWNED':
        return new ApplicationError(hint, 'Something went wrong linking the learner to your account. Please try again.');
    }
    if (error.code === '23505') {
      return new ApplicationError('DUPLICATE', 'You have already applied to this school for this learner this year.');
    }
    if (error.code === '23514' && /identity/.test(error.message)) {
      return new ApplicationError('UNKNOWN', 'That South African ID number is not valid. Please check it.');
    }
    return new ApplicationError('UNKNOWN', error.message);
  }
}

export interface MyChild {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  school_name: string | null;
  class_name: string | null;
  grade_label: string | null;
}

export interface ChildReportMark {
  mark: number | null;
  comment: string | null;
  subjects: { name: string; sort_order: number; language_level: string | null } | null;
}
export interface ChildReport {
  id: string;
  academic_year: number;
  term_number: number;
  days_absent: number | null;
  teacher_comment: string | null;
  principal_comment: string | null;
  published_at: string | null;
  report_marks: ChildReportMark[];
  classes: { name: string; grade_code: string } | null;
  schools: { name: string; stamp_url: string | null } | null;
}
