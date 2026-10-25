import { AfterViewInit, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { turnstileSiteKey } from '../environment';
import { TurnstileApi, TurnstileService } from './turnstile.service';

@Component({
  selector: 'skoolo-auth-challenge',
  template: `
    <div class="challenge" aria-label="Security check">
      <div #widget></div>
      @if (error()) {
        <p role="alert">{{ error() }}</p>
        <button type="button" (click)="reset()">Retry security check</button>
      } @else if (!verified()) {
        <p role="status">Complete the security check to continue.</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .challenge { display: grid; justify-items: center; gap: 8px; }
    p { margin: 0; font-size: .85rem; text-align: center; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
  `,
})
export class AuthChallengeComponent implements AfterViewInit {
  @ViewChild('widget', { static: true }) private widget!: ElementRef<HTMLElement>;
  private readonly loader = inject(TurnstileService);
  private readonly destroyRef = inject(DestroyRef);
  private api: TurnstileApi | undefined;
  private widgetId: string | undefined;
  private generation = 0;
  private token = signal('');
  private issuedAt = 0;
  private consumed = false;
  private waitTimer: ReturnType<typeof setTimeout> | undefined;
  readonly verified = computed(() => !!this.token());
  readonly error = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.clear());
  }

  ngAfterViewInit(): void { this.reset(); }

  /** Consume once. Supabase, not this component, validates the token server-side. */
  takeToken(): string | null {
    const token = this.token();
    this.token.set('');
    // Leave a margin within Turnstile's five-minute lifetime for the request to reach Supabase.
    if (!token || Date.now() - this.issuedAt >= 270000) {
      this.error.set('The security check is not ready or has expired. Please retry it.');
      return null;
    }
    this.consumed = true;
    return token;
  }

  reset(): void {
    if (this.destroyRef.destroyed) return;
    this.clear();
    this.error.set(null);
    void this.render(this.generation);
  }

  private clear(): void {
    ++this.generation;
    this.consumed = false;
    this.token.set('');
    clearTimeout(this.waitTimer);
    if (this.widgetId !== undefined) {
      this.api?.remove(this.widgetId);
      this.widgetId = undefined;
    }
  }

  private async render(generation: number): Promise<void> {
    const current = () => !this.destroyRef.destroyed && generation === this.generation;
    const failed = (message: string) => {
      if (!current()) return;
      clearTimeout(this.waitTimer);
      this.token.set('');
      this.error.set(message);
    };
    try {
      const api = await this.loader.load();
      if (!current()) return;
      this.api = api;
      this.waitTimer = setTimeout(() => failed('The security check is taking too long. Please retry it.'), 45000);
      this.widgetId = api.render(this.widget.nativeElement, {
        sitekey: turnstileSiteKey, theme: 'auto', size: 'compact', 'response-field': false,
        retry: 'never', 'refresh-expired': 'manual', 'refresh-timeout': 'manual',
        callback: token => {
          if (!current() || this.consumed) return;
          clearTimeout(this.waitTimer);
          this.issuedAt = Date.now();
          this.token.set(token);
          this.error.set(null);
        },
        'error-callback': () => { failed('The security check could not load. Check your connection and retry.'); return true; },
        'expired-callback': () => failed('The security check expired. Please retry it.'),
        'timeout-callback': () => failed('The security check timed out. Please retry it.'),
        'unsupported-callback': () => failed('This browser could not complete the security check. Try an updated browser.'),
      });
      if (this.widgetId === undefined) failed('The security check could not start. Please retry it.');
    } catch {
      failed('The security check could not load. Check your connection and retry.');
    }
  }
}
