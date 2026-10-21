import { Injectable } from '@angular/core';
import { injectSupabase } from '../supabase-client';
import type { Grade, GradeAvailability, SchoolDirectoryEntry } from '../models';

@Injectable({ providedIn: 'root' })
export class SchoolDirectoryService {
  private readonly client = injectSupabase();
  private gradesCache: Grade[] | null = null;

  /** Schools matching a name or town search, open-for-registration schools first. */
  async search(term: string): Promise<SchoolDirectoryEntry[]> {
    let query = this.client
      .from('school_directory')
      .select('*')
      .order('is_open_for_registration', { ascending: false })
      .order('name');
    const cleaned = term.trim().replace(/[,()%]/g, '');
    if (cleaned) {
      query = query.or(`name.ilike.%${cleaned}%,town.ilike.%${cleaned}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async bySlug(slug: string): Promise<SchoolDirectoryEntry | null> {
    const { data, error } = await this.client.from('school_directory').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Grade intake for an open enrolment period, with live places left. */
  async gradeAvailability(periodId: string): Promise<GradeAvailability[]> {
    const { data, error } = await this.client
      .from('period_grade_availability')
      .select('*')
      .eq('period_id', periodId)
      .order('sort_order');
    if (error) throw error;
    return data ?? [];
  }

  async grades(): Promise<Grade[]> {
    if (!this.gradesCache) {
      const { data, error } = await this.client.from('grades').select('*').order('sort_order');
      if (error) throw error;
      this.gradesCache = data ?? [];
    }
    return this.gradesCache;
  }
}
