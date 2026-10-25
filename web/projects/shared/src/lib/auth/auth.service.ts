import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js';
import { Subject } from 'rxjs';
import { injectSupabase } from '../supabase-client';

export interface SignUpDetails {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  /** Same-app confirmation destination; must be in the Supabase redirect allowlist. */
  emailRedirectTo: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = injectSupabase();
  private readonly readyPromise: Promise<void>;
  private eventVersion = 0;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;
  private readonly invalidated = new Subject<void>();
  /** Clear account-owned state synchronously, including pending reads, before rendering another account. */
  readonly stateInvalidated = this.invalidated.asObservable();

  /** Sticky until a full document navigation discards router/Ionic caches and old page instances. */
  readonly boundary = signal<'signed-out' | 'password-changed' | 'session-ended' | 'account-changed' | 'session-expired' | 'restore-failed' | null>(null);
  readonly signingOut = signal(false);
  readonly signOutFailed = signal(false);

  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);
  readonly user = computed<User | null>(() => this.boundary() ? null : this.session()?.user ?? null);
  readonly isSignedIn = computed(() => this.user() !== null);

  /** True once the user has arrived from a password-reset email link. */
  readonly isPasswordRecovery = signal(false);

  constructor() {
    const { data: { subscription } } = this.client.auth.onAuthStateChange((event, session) => {
      this.applySession(session, event);
    });
    this.readyPromise = this.restoreSession(true).finally(() => this.ready.set(true));
    const resume = () => { this.checkExpiry(); void this.restoreSession(false); };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', resume);
      window.addEventListener('pageshow', resume);
      document.addEventListener('visibilitychange', resume);
    }
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.expiryTimer);
      subscription.unsubscribe();
      this.invalidated.complete();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', resume);
        window.removeEventListener('pageshow', resume);
        document.removeEventListener('visibilitychange', resume);
      }
    });
  }

  private async restoreSession(initial: boolean): Promise<void> {
    const version = this.eventVersion;
    try {
      const { data, error } = await this.client.auth.getSession();
      // A late storage read must never overwrite a newer sign-out or account-change event.
      if (this.destroyed || version !== this.eventVersion) return;
      if (error) throw error;
      this.applySession(data.session);
    } catch {
      if (this.destroyed || version !== this.eventVersion) return;
      if (initial && !this.session()) this.closeContext('restore-failed');
      else this.checkExpiry();
    }
  }

  private applySession(session: Session | null, event?: AuthChangeEvent): void {
    if (this.destroyed) return;
    ++this.eventVersion;
    const previousId = this.session()?.user.id;
    if (previousId && previousId !== session?.user.id) {
      this.closeContext(session ? 'account-changed' : 'session-ended');
    } else if (previousId !== session?.user.id) {
      this.invalidated.next();
    }
    this.session.set(session);
    if (!session || previousId !== session.user.id || event === 'USER_UPDATED') this.isPasswordRecovery.set(false);
    if (event === 'PASSWORD_RECOVERY' && !this.boundary()) this.isPasswordRecovery.set(true);
    this.checkExpiry();
  }

  private checkExpiry(): void {
    clearTimeout(this.expiryTimer);
    const expiresAt = this.session()?.expires_at;
    if (!expiresAt || this.boundary()) return;
    const remaining = expiresAt * 1000 - Date.now();
    if (remaining <= 0) this.closeContext('session-expired');
    else this.expiryTimer = setTimeout(() => this.checkExpiry(), Math.min(remaining, 2_147_483_647));
  }

  private closeContext(reason: NonNullable<ReturnType<typeof this.boundary>>): void {
    if (this.boundary()) return;
    ++this.eventVersion;
    this.boundary.set(reason);
    this.isPasswordRecovery.set(false);
    clearTimeout(this.expiryTimer);
    this.invalidated.next();
  }

  /** Resolves once the persisted session (if any) has been restored. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  async signIn(email: string, password: string): Promise<AuthError | null> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (!error) this.isPasswordRecovery.set(false);
    return error;
  }

  /** Returns the error, or null. `needsEmailConfirmation` is true when no session was created. */
  async signUp(details: SignUpDetails): Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }> {
    const { data, error } = await this.client.auth.signUp({
      email: details.email,
      password: details.password,
      options: {
        emailRedirectTo: details.emailRedirectTo,
        data: { full_name: details.fullName, phone: details.phone },
      },
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

  async signOut(reason: 'signed-out' | 'password-changed' = 'signed-out'): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.signOutFailed.set(false);
    this.closeContext(reason);
    try {
      // Preserve the existing all-sessions scope; never silently claim remote revocation succeeded.
      const { error } = await this.client.auth.signOut({ scope: 'global' });
      this.signOutFailed.set(!!error);
      if (!error) this.applySession(null, 'SIGNED_OUT');
    } catch {
      this.signOutFailed.set(true);
    } finally {
      this.signingOut.set(false);
    }
  }
}
