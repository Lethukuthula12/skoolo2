import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { StaffService } from '../staff/staff.service';

export type FeedbackKind = 'pending' | 'success' | 'error';
export interface FeedbackSource { id: number; path: string; account: string | null; school: string | null; }
export interface FeedbackNotice { id: number; kind: FeedbackKind; message: string; leaving: boolean; paused: boolean; }
interface FeedbackTimer { handle?: ReturnType<typeof setTimeout>; remaining: number; started: number; pauses: Set<string>; }

/** Viewport feedback only. This service never performs, retries or approves an operation. */
@Injectable({ providedIn: 'root' })
export class ActionFeedbackService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly staff = inject(StaffService);
  private nextId = 0;
  private path = this.routePath(this.router.url);
  private readonly timers = new Map<number, FeedbackTimer>();
  readonly notices = signal<FeedbackNotice[]>([]);
  private readonly outlets = signal<{ id: number; priority: number }[]>([]);
  readonly activeOutlet = computed(() => [...this.outlets()].sort((a, b) => a.priority - b.priority).at(-1)?.id);

  outletId(): number { return ++this.nextId; }
  setOutlet(id: number, active: boolean, priority: number): void {
    this.outlets.update(outlets => [...outlets.filter(outlet => outlet.id !== id), ...(active ? [{ id, priority }] : [])]);
  }

  constructor() {
    const navigation = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) { this.path = this.routePath(event.url); this.clear(); }
      if (event instanceof NavigationEnd) this.path = this.routePath(event.urlAfterRedirects);
      if (event instanceof NavigationCancel || event instanceof NavigationError) this.path = this.routePath(this.router.url);
    });
    const invalidation = this.auth.stateInvalidated.subscribe(() => this.clear());
    let account = this.auth.user()?.id, school = this.staff.currentSchoolId();
    effect(() => {
      const nextAccount = this.auth.user()?.id, nextSchool = this.staff.currentSchoolId();
      if (account !== nextAccount || school !== nextSchool) untracked(() => this.clear());
      account = nextAccount; school = nextSchool;
    });
    const visibility = () => {
      for (const notice of this.notices()) {
        if (document.hidden) this.pause(notice.id, 'hidden'); else this.resume(notice.id, 'hidden');
      }
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
    inject(DestroyRef).onDestroy(() => {
      navigation.unsubscribe(); invalidation.unsubscribe(); this.clear();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
    });
  }

  source(): FeedbackSource {
    return { id: ++this.nextId, path: this.routePath(this.router.getCurrentNavigation()?.finalUrl?.toString() ?? this.router.url),
      account: this.auth.user()?.id ?? null, school: this.staff.currentSchoolId() };
  }

  show(source: FeedbackSource, kind: FeedbackKind, message: string): void {
    if (!message.trim() || this.auth.boundary() || source.account !== (this.auth.user()?.id ?? null)
      || source.school !== this.staff.currentSchoolId() || source.path !== this.path) return;
    const existing = this.notices().find(n => n.id === source.id);
    if (existing && !existing.leaving && existing.kind === kind && existing.message === message) return;
    const pauses = new Set(existing?.leaving ? [] : this.timers.get(source.id)?.pauses ?? []);
    if (typeof document !== 'undefined' && document.hidden) pauses.add('hidden');
    this.stopTimer(source.id);
    const notice: FeedbackNotice = { id: source.id, kind, message, leaving: false, paused: pauses.size > 0 };
    this.notices.update(list => [...list.filter(n => n.id !== source.id), notice]);
    // Limit overlap without dropping the latest outcome. Existing inline details remain available.
    while (this.notices().length > 3) this.remove(this.notices()[0].id);
    const timer: FeedbackTimer = { remaining: kind === 'success' ? 6000 : 0, started: Date.now(), pauses };
    this.timers.set(source.id, timer);
    this.arm(source.id, timer);
  }

  dismiss(id: number): void {
    const notice = this.notices().find(n => n.id === id);
    if (!notice || notice.leaving) return;
    this.stopTimer(id);
    this.notices.update(list => list.map(n => n.id === id ? { ...n, leaving: true } : n));
    const handle = setTimeout(() => this.remove(id), 180);
    this.timers.set(id, { handle, remaining: 0, started: Date.now(), pauses: new Set() });
  }
  remove(id: number): void { this.stopTimer(id); this.notices.update(list => list.filter(n => n.id !== id)); }
  clear(): void { for (const id of this.timers.keys()) this.stopTimer(id); this.notices.set([]); }

  pause(id: number, reason: string): void {
    const timer = this.timers.get(id);
    if (!timer || timer.pauses.has(reason) || this.notices().find(n => n.id === id)?.leaving) return;
    if (timer.handle) {
      clearTimeout(timer.handle); timer.handle = undefined;
      timer.remaining = Math.max(1, timer.remaining - (Date.now() - timer.started));
    }
    timer.pauses.add(reason);
    this.notices.update(list => list.map(n => n.id === id ? { ...n, paused: true } : n));
  }
  resume(id: number, reason: string): void {
    const timer = this.timers.get(id);
    if (!timer || !timer.pauses.delete(reason) || this.notices().find(n => n.id === id)?.leaving) return;
    this.notices.update(list => list.map(n => n.id === id ? { ...n, paused: timer.pauses.size > 0 } : n));
    if (timer.pauses.size === 0) this.arm(id, timer);
  }
  private arm(id: number, timer: FeedbackTimer): void {
    if (timer.remaining <= 0 || timer.pauses.size > 0) return;
    timer.started = Date.now(); timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }
  private stopTimer(id: number): void {
    const timer = this.timers.get(id); if (timer?.handle) clearTimeout(timer.handle); this.timers.delete(id);
  }
  private routePath(url: string): string { return url.split(/[?#]/)[0]; }
}
