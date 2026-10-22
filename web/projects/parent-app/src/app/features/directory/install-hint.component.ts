import { Component, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

const DISMISSED_KEY = 'skoolo.installHintDismissed';

/**
 * iPhones never prompt to install a web app; the only route is Safari's Share sheet.
 * Shows a one-line hint to iOS visitors who are not already running the installed app.
 */
@Component({
  selector: 'app-install-hint',
  imports: [IonButton, IonIcon],
  template: `
    @if (visible()) {
      <div class="hint" role="note">
        <ion-icon name="phone-portrait-outline" aria-hidden="true" />
        <span>
          @if (isSafari) {
            Add Skoolo to your home screen: tap <strong>Share</strong>
            <ion-icon name="share-outline" aria-label="Share icon" /> then <strong>Add to Home Screen</strong>.
          } @else {
            To install Skoolo on iPhone, open this page in <strong>Safari</strong>, tap Share, then Add to Home Screen.
          }
        </span>
        <ion-button fill="clear" size="small" (click)="dismiss()" aria-label="Dismiss">
          <ion-icon slot="icon-only" name="close-circle-outline" />
        </ion-button>
      </div>
    }
  `,
  styles: `
    .hint {
      display: flex; align-items: center; gap: 10px; margin: 10px 12px 0;
      padding: 10px 6px 10px 14px; border-radius: 12px; background: rgba(31, 75, 216, 0.08);
      font-size: 0.88rem; line-height: 1.35;
    }
    .hint > ion-icon:first-child { font-size: 22px; color: var(--ion-color-primary); flex-shrink: 0; }
    .hint span { flex: 1; }
    .hint span ion-icon { vertical-align: -3px; }
    ion-button { margin: 0; --padding-start: 4px; --padding-end: 4px; }
  `,
})
export class InstallHintComponent {
  protected readonly isSafari: boolean;
  protected readonly visible = signal(false);

  constructor() {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;
    this.isSafari = isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      dismissed = false;
    }
    this.visible.set(isIos && !standalone && !dismissed);
  }

  protected dismiss(): void {
    this.visible.set(false);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private browsing: the hint simply shows again next visit.
    }
  }
}
