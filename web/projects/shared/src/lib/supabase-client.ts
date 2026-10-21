import { InjectionToken, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabaseEnvironment } from './environment';

export type SkooloClient = SupabaseClient<Database>;

export const SUPABASE_CLIENT = new InjectionToken<SkooloClient>('SUPABASE_CLIENT', {
  providedIn: 'root',
  factory: () =>
    createClient<Database>(supabaseEnvironment.url, supabaseEnvironment.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
});

export function injectSupabase(): SkooloClient {
  return inject(SUPABASE_CLIENT);
}
