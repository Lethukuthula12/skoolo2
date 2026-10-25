import { Injectable, inject } from '@angular/core';
import { AuthService, StaffService, injectSupabase } from '@skoolo/shared';
import type { Database, Json } from '@skoolo/shared';
import type { Paper, PaperContent, PaperTemplate } from './paper.model';

export type PaperOption = Database['public']['Functions']['paper_authoring_options']['Returns'][number];
export type Reviewer = Database['public']['Functions']['paper_reviewers']['Returns'][number];
export type PaperSummary = Pick<Paper, 'id' | 'title' | 'status' | 'author_id' | 'reviewer_id' | 'updated_at' | 'total_marks' | 'display_context' | 'term_number'>;

@Injectable({ providedIn: 'root' })
export class PaperService {
  private readonly client = injectSupabase();
  private readonly staff = inject(StaffService);
  private readonly auth = inject(AuthService);
  private schoolId(): string {
    const id = this.staff.currentSchoolId();
    if (!id) throw new Error('Choose a school first.');
    return id;
  }
  async list(): Promise<PaperSummary[]> {
    let query = this.client.from('assessment_papers')
      .select('id,title,status,author_id,reviewer_id,updated_at,total_marks,display_context,term_number')
      .eq('school_id', this.schoolId());
    if (!this.staff.isAdmin()) query = query.eq('author_id', this.auth.user()!.id);
    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  async get(id: string): Promise<Paper> {
    const { data, error } = await this.client.from('assessment_papers').select('*').eq('school_id', this.schoolId()).eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  }
  async options(): Promise<PaperOption[]> {
    const { data, error } = await this.client.rpc('paper_authoring_options', { p_school_id: this.schoolId() });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  async reviewers(): Promise<Reviewer[]> {
    const { data, error } = await this.client.rpc('paper_reviewers', { p_school_id: this.schoolId() });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  async templates(): Promise<PaperTemplate[]> {
    const { data, error } = await this.client.from('paper_templates').select('*').eq('school_id', this.schoolId()).order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  async saveTemplate(input: Pick<PaperTemplate, 'name' | 'instructions' | 'duration_minutes' | 'footer'>, id: string | null): Promise<void> {
    const row = { ...input, school_id: this.schoolId() };
    const { error } = id
      ? await this.client.from('paper_templates').update(row).eq('school_id', row.school_id).eq('id', id)
      : await this.client.from('paper_templates').insert(row);
    if (error) throw new Error(error.message);
  }
  async deleteTemplate(id: string): Promise<void> {
    const { error } = await this.client.from('paper_templates').delete().eq('school_id', this.schoolId()).eq('id', id);
    if (error) throw new Error(error.message);
  }
  async save(paper: Paper | null, content: PaperContent): Promise<Paper> {
    const { data, error } = await this.client.rpc('save_assessment_paper', {
      p_id: (paper?.id ?? null) as unknown as string, p_revision: paper?.revision ?? 0,
      p_school_id: this.schoolId(), p_content: content as unknown as Json,
    });
    if (error) throw new Error(error.message);
    return data;
  }
  async transition(paper: Paper, action: 'submit' | 'withdraw' | 'approve' | 'return', note = ''): Promise<Paper> {
    const { data, error } = await this.client.rpc('transition_assessment_paper', { p_id: paper.id, p_revision: paper.revision, p_action: action, p_note: note });
    if (error) throw new Error(error.message);
    return data;
  }
  async revise(paper: Paper): Promise<Paper> {
    const { data, error } = await this.client.rpc('revise_assessment_paper', { p_id: paper.id });
    if (error) throw new Error(error.message);
    return data;
  }
  async link(paper: Paper, assessmentId: string | null, weight: number): Promise<Paper> {
    const { data, error } = await this.client.rpc('link_paper_assessment', {
      p_id: paper.id, p_revision: paper.revision, p_assessment_id: assessmentId as string, p_weight: weight,
    });
    if (error) throw new Error(error.message);
    return data;
  }
  async history(id: string) {
    const { data, error } = await this.client.from('paper_events').select('*').eq('school_id', this.schoolId()).eq('paper_id', id).order('created_at');
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
