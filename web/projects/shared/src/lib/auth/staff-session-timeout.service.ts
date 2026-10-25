import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ABSOLUTE_LIMIT_MS = 8 * 60 * 60 * 1000;
const WARNING_LEAD_MS = 2 * 60 * 1000;
const STORAGE_PREFIX = 'skoolo.staff-session-started.';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const ACTIVITY_THROTTLE_MS = 5_000;

export interface StaffSessionWarning { reason: 'idle' | 'session'; secondsRemaining: number; }

/**
 * Agreed staff limits (30 min idle / 8 h max), enforced only in this browser tab. This is not
 * the server-side registry in docs/session-security-design.md; a stolen or replayed token is
 * unaffected. Inject (and render `StaffSessionWarningComponent`) only from staff-only surfaces.
 */
@Injectable({ providedIn: 'root' })
export class StaffSessionTimeoutService {
  private readonly auth = inject(AuthService);
  private lastActivity = Date.now();
  private sessionStartedAt: number | null = null;
  private userId: string | null = null;
  private tickHandle: ReturnType<typeof setInterval> | undefined;

  readonly warning = signal<StaffSessionWarning | null>(null);

  constructor() {
    const onActivity = () => {
      const now = Date.now();
      if (now - this.lastActivity < ACTIVITY_THROTTLE_MS) return;
      this.lastActivity = now;
      if (this.warning()?.reason === 'idle') this.warning.set(null);
    };
    if (typeof window !== 'undefined') {
      for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
      this.tickHandle = setInterval(() => this.tick(), 1_000);
    }
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.tickHandle);
      if (typeof window !== 'undefined') for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
    });
  }

  /** Resets the idle clock. The absolute limit is fixed and cannot be extended this way. */
  stayActive(): void {
    this.lastActivity = Date.now();
    if (this.warning()?.reason === 'idle') this.warning.set(null);
  }

  private tick(): void {
    const user = this.auth.user();
    if (!user || this.auth.boundary()) { this.reset(); return; }
    if (user.id !== this.userId) this.beginTracking(user.id);

    const idleRemaining = IDLE_LIMIT_MS - (Date.now() - this.lastActivity);
    const absoluteRemaining = this.sessionStartedAt === null ? ABSOLUTE_LIMIT_MS : ABSOLUTE_LIMIT_MS - (Date.now() - this.sessionStartedAt);
    const remaining = Math.min(idleRemaining, absoluteRemaining);

    if (remaining <= 0) {
      this.reset();
      void this.auth.signOut('signed-out');
      return;
    }
    if (remaining <= WARNING_LEAD_MS) {
      this.warning.set({ reason: idleRemaining <= absoluteRemaining ? 'idle' : 'session', secondsRemaining: Math.ceil(remaining / 1000) });
    } else if (this.warning()) {
      this.warning.set(null);
    }
  }

  private beginTracking(userId: string): void {
    this.userId = userId;
    this.lastActivity = Date.now();
    this.warning.set(null);
    const key = STORAGE_PREFIX + userId;
    const stored = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(key)) : NaN;
    if (Number.isFinite(stored) && stored > 0) {
      this.sessionStartedAt = stored;
    } else {
      this.sessionStartedAt = Date.now();
      try { localStorage.setItem(key, String(this.sessionStartedAt)); } catch { /* storage unavailable */ }
    }
  }

  private reset(): void {
    if (this.userId) { try { localStorage.removeItem(STORAGE_PREFIX + this.userId); } catch { /* storage unavailable */ } }
    this.userId = null;
    this.sessionStartedAt = null;
    this.warning.set(null);
  }
}
