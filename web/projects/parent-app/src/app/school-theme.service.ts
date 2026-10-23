import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ApplicationService } from '@skoolo/shared';

/** Wears the parent's school brand: applies that school's primary colour to the app's Ionic theme,
 *  so a school that customises its portal also recolours its parents' app. */
const CACHE_KEY = 'skoolo-app-primary';
const DEFAULT_PRIMARY = '#3a41c4';
const HEX = /^#[0-9a-fA-F]{6}$/;

@Injectable({ providedIn: 'root' })
export class SchoolThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly applications = inject(ApplicationService);

  constructor() {
    const cached = this.read();
    if (cached) this.apply(cached); // instant, before the network answers
  }

  /** Look up the signed-in parent's school colour and apply it. */
  async refreshForParent(): Promise<void> {
    try {
      const theme = await this.applications.mySchoolTheme();
      this.apply(theme?.primary && HEX.test(theme.primary) ? theme.primary : DEFAULT_PRIMARY);
    } catch {
      /* keep whatever is applied */
    }
  }

  reset(): void {
    this.apply(DEFAULT_PRIMARY);
  }

  private apply(primary: string): void {
    const s = this.doc.documentElement.style;
    const [r, g, b] = toRgb(primary);
    s.setProperty('--ion-color-primary', primary);
    s.setProperty('--ion-color-primary-rgb', `${r}, ${g}, ${b}`);
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
