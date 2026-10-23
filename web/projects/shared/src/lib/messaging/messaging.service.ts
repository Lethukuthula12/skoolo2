import { Injectable } from '@angular/core';
import { injectSupabase } from '../supabase-client';
import type { Tables } from '../database.types';

export type AbsenceReport = Tables<'absence_reports'>;
export type MessageThread = Tables<'message_threads'>;
export type ThreadMessage = Tables<'thread_messages'>;

export type AbsenceRow = AbsenceReport & {
  learners: { first_name: string; last_name: string; current_class_id: string | null } | null;
};
export type ThreadRow = MessageThread & {
  learners: { first_name: string; last_name: string } | null;
};

/** Absence reporting and two-way message threads, shared by the parent app and the portal. */
@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly client = injectSupabase();

  // ----- Absences -----------------------------------------------------------

  /** Parent reports an absence for their child, with an optional note file. */
  async reportAbsence(
    learnerId: string, start: string, end: string, reason: string, note?: string | null, file?: File | null,
  ): Promise<string> {
    let documentPath: string | null = null;
    if (file) {
      const { data: learner } = await this.client.from('learners').select('school_id').eq('id', learnerId).maybeSingle();
      const schoolId = learner?.school_id ?? 'unknown';
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
      documentPath = `${schoolId}/${learnerId}/${Date.now()}_${safe}`;
      const { error } = await this.client.storage.from('absence-notes').upload(documentPath, file, { contentType: file.type });
      if (error) throw error;
    }
    const { data, error } = await this.client.rpc('report_absence', {
      p_learner_id: learnerId, p_start: start, p_end: end, p_reason: reason,
      p_note: note ?? undefined, p_document_path: documentPath ?? undefined,
    });
    if (error) throw error;
    return data as string;
  }

  async childAbsences(learnerId: string): Promise<AbsenceReport[]> {
    const { data, error } = await this.client
      .from('absence_reports')
      .select('*')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Absences the signed-in staff member may see (their classes, or the whole school for admins). */
  async schoolAbsences(): Promise<AbsenceRow[]> {
    const { data, error } = await this.client
      .from('absence_reports')
      .select('*, learners(first_name, last_name, current_class_id)')
      .order('status')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as AbsenceRow[];
  }

  async acknowledgeAbsence(id: string): Promise<void> {
    const { error } = await this.client.rpc('acknowledge_absence', { p_absence_id: id });
    if (error) throw error;
  }

  async absenceNoteUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage.from('absence-notes').createSignedUrl(path, 60 * 15);
    if (error) throw error;
    return data.signedUrl;
  }

  // ----- Threads ------------------------------------------------------------

  async threadsForLearner(learnerId: string): Promise<MessageThread[]> {
    const { data, error } = await this.client
      .from('message_threads')
      .select('*')
      .eq('learner_id', learnerId)
      .order('last_message_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** All threads the signed-in user may see (for the portal's messages list). */
  async allThreads(): Promise<ThreadRow[]> {
    const { data, error } = await this.client
      .from('message_threads')
      .select('*, learners(first_name, last_name)')
      .order('last_message_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ThreadRow[];
  }

  async threadMessages(threadId: string): Promise<ThreadMessage[]> {
    const { data, error } = await this.client
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  async startThread(learnerId: string, subject: string, body: string): Promise<string> {
    const { data, error } = await this.client.rpc('start_thread', { p_learner_id: learnerId, p_subject: subject, p_body: body });
    if (error) throw error;
    return data as string;
  }

  async postMessage(threadId: string, body: string): Promise<void> {
    const { error } = await this.client.rpc('post_message', { p_thread_id: threadId, p_body: body });
    if (error) throw error;
  }

  async messageClass(classId: string, subject: string, body: string): Promise<number> {
    const { data, error } = await this.client.rpc('message_class', { p_class_id: classId, p_subject: subject, p_body: body });
    if (error) throw error;
    return data ?? 0;
  }
}
