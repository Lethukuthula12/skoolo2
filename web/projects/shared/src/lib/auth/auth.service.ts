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

  /** True once the user has arrived from a password-reset email link. */
  readonly isPasswordRecovery = signal(false);

  constructor() {
    this.readyPromise = this.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.ready.set(true);
    });
    this.client.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      if (event === 'PASSWORD_RECOVERY') {
        this.isPasswordRecovery.set(true);
      }
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

  /** Sends a password-reset email with a link back to `redirectTo` (must be an allowed URL). */
  async requestPasswordReset(email: string, redirectTo: string): Promise<AuthError | null> {
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return error;
  }

  /** Sets a new password for the user in the current (recovery or signed-in) session. */
  async updatePassword(password: string): Promise<AuthError | null> {
    const { error } = await this.client.auth.updateUser({ password });
    return error;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    this.isPasswordRecovery.set(false);
  }
}
