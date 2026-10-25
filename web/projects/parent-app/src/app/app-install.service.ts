import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Captured at app startup so lazy routes cannot miss Chrome's installation offer. */
@Injectable({ providedIn: 'root' })
export class AppInstallService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly displayMode = window.matchMedia('(display-mode: standalone)');
  private deferred: InstallPromptEvent | null = null;
  readonly isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  readonly isAndroid = /Android/i.test(navigator.userAgent);
  readonly installed = signal(this.isStandalone());
  readonly canInstall = signal(false);
  readonly busy = signal(false);
  readonly dismissed = signal(false);
  readonly message = signal<string | null>(null);
  readonly canOffer = computed(() => !this.installed() && (this.isIos || this.isAndroid || this.canInstall()));

  constructor() {
    try { this.dismissed.set(sessionStorage.getItem('skoolo.installHintDismissed') === '1'); } catch { /* Optional preference. */ }
    const offered = (event: Event) => {
      if (this.installed()) return;
      event.preventDefault();
      this.deferred = event as InstallPromptEvent;
      this.canInstall.set(true);
      this.message.set(null);
    };
    const installed = () => {
      this.installed.set(true);
      this.deferred = null;
      this.canInstall.set(false);
      this.message.set(null);
    };
    const modeChanged = () => { if (this.isStandalone()) installed(); };
    window.addEventListener('beforeinstallprompt', offered);
    window.addEventListener('appinstalled', installed);
    this.displayMode.addEventListener('change', modeChanged);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', offered);
      window.removeEventListener('appinstalled', installed);
      this.displayMode.removeEventListener('change', modeChanged);
      this.deferred = null;
    });
  }

  async install(): Promise<void> {
    if (this.busy() || this.installed()) return;
    const event = this.deferred;
    if (!event) {
      this.message.set('Use the installation steps below to add Skoolo from your browser menu.');
      return;
    }
    // Browser prompt events can only be used once. Call prompt directly from the tap handler.
    this.deferred = null;
    this.canInstall.set(false);
    this.busy.set(true);
    this.message.set(null);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (!this.installed() && !this.destroyRef.destroyed) {
        this.message.set(outcome === 'accepted'
          ? 'Finish installation in your browser, then open Skoolo from your home screen.'
          : 'You can add Skoolo later using the installation steps below.');
      }
    } catch {
      if (!this.installed() && !this.destroyRef.destroyed) {
        this.message.set('The install prompt could not open. Use the installation steps below.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
    try { sessionStorage.setItem('skoolo.installHintDismissed', '1'); } catch { /* Keep the in-memory preference. */ }
  }

  private isStandalone(): boolean {
    return this.displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }
}
