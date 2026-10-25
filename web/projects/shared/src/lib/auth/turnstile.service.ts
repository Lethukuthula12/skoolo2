import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

export interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string;
    size: 'compact';
    theme: 'auto';
    'response-field': false;
    retry: 'never';
    'refresh-expired': 'manual';
    'refresh-timeout': 'manual';
    callback: (token: string) => void;
    'error-callback': () => boolean;
    'expired-callback': () => void;
    'timeout-callback': () => void;
    'unsupported-callback': () => void;
  }): string | undefined;
  remove(id: string): void;
}

declare global { interface Window { turnstile?: TurnstileApi; } }

@Injectable({ providedIn: 'root' })
export class TurnstileService {
  private readonly document = inject(DOCUMENT);
  private pending: Promise<TurnstileApi> | undefined;

  load(): Promise<TurnstileApi> {
    const existing = this.document.defaultView?.turnstile;
    if (existing) return Promise.resolve(existing);
    if (this.pending) return this.pending;
    this.pending = new Promise<TurnstileApi>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      const fail = () => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        script.remove();
        reject(new Error('Security check unavailable'));
      };
      const timer = setTimeout(fail, 15000);
      script.onerror = fail;
      script.onload = () => {
        const api = this.document.defaultView?.turnstile;
        if (!api) { fail(); return; }
        clearTimeout(timer);
        script.onload = script.onerror = null;
        resolve(api);
      };
      this.document.head.appendChild(script);
    }).catch(error => {
      this.pending = undefined;
      throw error;
    });
    return this.pending;
  }
}
