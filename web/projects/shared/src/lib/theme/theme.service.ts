import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** The portal look a school's admin can choose. Colours are #rrggbb. */
export interface Theme {
  primary: string;
  header: string;
  sidebar: string;
  mode: 'light' | 'dark';
}

export const DEFAULT_THEME: Theme = { primary: '#3a41c4', header: '#3a41c4', sidebar: '#22223d', mode: 'light' };

/** Swatches offered in the customizer. */
export const PRIMARY_SWATCHES = ['#3a41c4', '#5b4bd6', '#6610f2', '#00ada3', '#1f6fe8', '#1e8e5a', '#e2544b', '#fb7d5b', '#c3891c', '#14213d'];
export const SIDEBAR_SWATCHES = ['#22223d', '#1a1a28', '#1e1a46', '#0b3d3a', '#2b2f45', '#3b2a24', '#14213d', '#ffffff'];

const CACHE_KEY = 'skoolo-portal-theme';
const HEX = /^#[0-9a-fA-F]{6}$/;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private applied: Theme = DEFAULT_THEME;

  constructor() {
    // Apply the last-used theme immediately so a reload does not flash the default first.
    const cached = this.readCache();
    if (cached) {
      this.applied = cached;
      this.setVars(cached);
    }
  }

  /** The theme currently saved for this school (not a live preview). */
  current(): Theme {
    return this.applied;
  }

  /** Apply (and cache) the theme stored on the signed-in school; falls back to the default. */
  applyFromSchool(school: { theme?: unknown } | null): void {
    const theme = this.normalize(school?.theme);
    this.applied = theme;
    this.setVars(theme);
    this.writeCache(theme);
  }

  /** Show a change live without saving it. */
  preview(partial: Partial<Theme>): void {
    this.setVars({ ...this.applied, ...partial });
  }

  /** Discard an unsaved preview, back to the saved theme. */
  resetPreview(): void {
    this.setVars(this.applied);
  }

  /** Coerce arbitrary stored JSON into a valid theme, keeping only #rrggbb values. */
  normalize(value: unknown): Theme {
    const t = (value ?? {}) as Partial<Theme>;
    const pick = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v : fallback);
    return {
      primary: pick(t.primary, DEFAULT_THEME.primary),
      header: pick(t.header, DEFAULT_THEME.header),
      sidebar: pick(t.sidebar, DEFAULT_THEME.sidebar),
      mode: t.mode === 'dark' ? 'dark' : 'light',
    };
  }

  private setVars(t: Theme): void {
    const s = this.doc.documentElement.style;
    s.setProperty('--brand', t.primary);
    s.setProperty('--brand-dark', darken(t.primary, 0.14));
    s.setProperty('--brand-soft', rgba(t.primary, 0.08));
    s.setProperty('--ring', rgba(t.primary, 0.25));
    s.setProperty('--header-bg', t.header);
    s.setProperty('--sidebar-bg', t.sidebar);
    // The sidebar text must follow the sidebar's own lightness (it can be white too).
    const dark = isDark(t.sidebar);
    s.setProperty('--sidebar-ink', dark ? 'rgba(255, 255, 255, 0.66)' : '#5b6478');
    s.setProperty('--sidebar-ink-hover', dark ? '#ffffff' : t.primary);
    s.setProperty('--sidebar-school', dark ? 'rgba(255, 255, 255, 0.5)' : '#8a8fab');
    s.setProperty('--sidebar-hover', dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)');

    // Light or dark content area. Dark mode overrides the surface/text tokens; light removes the
    // overrides so the stylesheet's :root (light) values apply.
    if (t.mode === 'dark') {
      s.setProperty('--bg', '#15162b');
      s.setProperty('--card', '#20223c');
      s.setProperty('--surface-2', '#2a2c48');
      s.setProperty('--title', '#eef0fb');
      s.setProperty('--ink', '#c9cde6');
      s.setProperty('--muted', '#9398bb');
      s.setProperty('--line', 'rgba(255, 255, 255, 0.09)');
      s.setProperty('--shadow', '0 6px 20px rgba(0, 0, 0, 0.35)');
      s.setProperty('--shadow-lg', '0 12px 32px rgba(0, 0, 0, 0.45)');
      s.setProperty('color-scheme', 'dark');
    } else {
      for (const p of ['--bg', '--card', '--surface-2', '--title', '--ink', '--muted', '--line', '--shadow', '--shadow-lg', 'color-scheme']) {
        s.removeProperty(p);
      }
    }
  }

  private readCache(): Theme | null {
    try {
      const raw = this.doc.defaultView?.localStorage.getItem(CACHE_KEY);
      return raw ? this.normalize(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  private writeCache(t: Theme): void {
    try {
      this.doc.defaultView?.localStorage.setItem(CACHE_KEY, JSON.stringify(t));
    } catch {
      /* private mode / blocked storage — the theme still applies this session */
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(n, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${[d(r), d(g), d(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  // Perceived luminance (0–255); below ~140 reads as a dark surface needing light text.
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}
