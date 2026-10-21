import { Injectable, computed, signal } from '@angular/core';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { injectSupabase } from '../supabase-client';

export interface SignUpDetails {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = injectSupabase();
  private readonly readyPromise: Promise<void>;

  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);
  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly isSignedIn = computed(() => this.session() !== null);

  constructor() {
    this.readyPromise = this.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.ready.set(true);
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
    });
  }

  /** Resolves once the persisted session (if any) has been restored. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  async signIn(email: string, password: string): Promise<AuthError | null> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    return error;
  }

  /** Returns the error, or null. `needsEmailConfirmation` is true when no session was created. */
  async signUp(details: SignUpDetails): Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }> {
    const { data, error } = await this.client.auth.signUp({
      email: details.email,
      password: details.password,
      options: { data: { full_name: details.fullName, phone: details.phone } },
    });
    return { error, needsEmailConfirmation: !error && data.session === null };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }
}
