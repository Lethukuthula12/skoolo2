import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ApplicationService } from '@skoolo/shared';

/** Wears the parent's school brand: applies that school's primary colour to the app's Ionic theme,
 *  so a school that customises its portal also recolours its parents' app. */
const CACHE_KEY = 'skoolo-app-primary';
const DEFAULT_PRIMARY = '#5145b5';
const HEX = /^#[0-9a-fA-F]{6}$/;

@Injectable({ providedIn: 'root' })
export class SchoolThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly applications = inject(ApplicationService);
  private requestVersion = 0;

  constructor() {
    const cached = this.read();
    if (cached) this.apply(cached); // instant, before the network answers
  }

  /** Look up the signed-in parent's school colour and apply it. */
  async refreshForParent(): Promise<void> {
    const version = ++this.requestVersion;
    try {
      const theme = await this.applications.mySchoolTheme();
      if (version !== this.requestVersion) return;
      this.apply(theme?.primary && HEX.test(theme.primary) ? theme.primary : DEFAULT_PRIMARY);
    } catch {
      /* keep whatever is applied */
    }
  }

  reset(): void {
    ++this.requestVersion;
    this.apply(DEFAULT_PRIMARY);
  }

  private apply(primary: string): void {
    const s = this.doc.documentElement.style;
    const [r, g, b] = toRgb(primary);
    s.setProperty('--ion-color-primary', primary);
    s.setProperty('--ion-color-primary-rgb', `${r}, ${g}, ${b}`);
    // A school's light accent still needs readable buttons and links on white cards.
    const useWhite = contrastWithWhite(primary) >= 4.5;
    s.setProperty('--ion-color-primary-contrast', useWhite ? '#ffffff' : '#000000');
    s.setProperty('--ion-color-primary-contrast-rgb', useWhite ? '255, 255, 255' : '0, 0, 0');
    let ink = primary;
    while (contrastWithWhite(ink) < 5) ink = shade(ink, 0.1);
    s.setProperty('--skoolo-brand-ink', ink);
    s.setProperty('--ion-color-primary-shade', shade(primary, 0.12));
    s.setProperty('--ion-color-primary-tint', shade(primary, -0.1));
    try { this.doc.defaultView?.localStorage.setItem(CACHE_KEY, primary); } catch { /* blocked storage */ }
  }

  private read(): string | null {
    try {
      const v = this.doc.defaultView?.localStorage.getItem(CACHE_KEY);
      return v && HEX.test(v) ? v : null;
    } catch {
      return null;
    }
  }
}

function contrastWithWhite(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// positive amount darkens, negative lightens
function shade(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  const f = (v: number) => {
    const t = amount >= 0 ? v * (1 - amount) : v + (255 - v) * -amount;
    return Math.max(0, Math.min(255, Math.round(t)));
  };
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
