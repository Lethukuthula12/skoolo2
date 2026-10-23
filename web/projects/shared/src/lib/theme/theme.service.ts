import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** The portal look a school's admin can choose. Colours are #rrggbb. */
export interface Theme {
  primary: string;
  header: string;
  sidebar: string;
  mode: 'light' | 'dark';
}

export const DEFAULT_THEME: Theme = { primary: '#5145b5', header: '#ffffff', sidebar: '#4d44a8', mode: 'light' };

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
    s.setProperty('--brand-hover-contrast', foreground(darken(t.primary, 0.14)));
    s.setProperty('--brand-soft', rgba(t.primary, t.mode === 'dark' ? 0.18 : 0.08));
    s.setProperty('--brand-contrast', foreground(t.primary));
    s.setProperty('--brand-ink', readable(t.primary, t.mode === 'dark' ? '#20223c' : '#ffffff'));
    s.setProperty('--ring', rgba(t.primary, 0.25));
    s.setProperty('--header-bg', t.header);
    const headerInk = contrast('#303972', t.header) >= 4.5 ? '#303972' : foreground(t.header);
    s.setProperty('--header-ink', headerInk);
    s.setProperty('--header-muted', headerInk);
    s.setProperty('--header-control', headerInk === '#ffffff' ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.65)');
    s.setProperty('--sidebar-bg', t.sidebar);
    // The sidebar text must follow the sidebar's own lightness (it can be white too).
    const sidebarInk = foreground(t.sidebar);
    const dark = sidebarInk === '#ffffff';
    s.setProperty('--sidebar-ink', sidebarInk);
    s.setProperty('--sidebar-ink-hover', sidebarInk);
    s.setProperty('--sidebar-school', sidebarInk);
    const activeSurface = mix(t.sidebar, dark ? '#ffffff' : '#000000', 0.14);
    s.setProperty('--sidebar-active', activeSurface);
    s.setProperty('--sidebar-active-ink', foreground(activeSurface));
    s.setProperty('--sidebar-hover', dark ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)');

    // Light or dark content area. Dark mode overrides the surface/text tokens; light removes the
    // overrides so the stylesheet's :root (light) values apply.
    if (t.mode === 'dark') {
      s.setProperty('--bg', '#15162b');
      s.setProperty('--card', '#20223c');
      s.setProperty('--surface-2', '#2a2c48');
      s.setProperty('--title', '#eef0fb');
      s.setProperty('--ink', '#c9cde6');
      s.setProperty('--muted', '#acb1cc');
      s.setProperty('--table-head', '#292b49');
      s.setProperty('--success', '#74d6a6');
      s.setProperty('--warning', '#f6cc76');
      s.setProperty('--danger', '#ff919c');
      s.setProperty('--accent-dark', '#ffae96');
      s.setProperty('--line', 'rgba(255, 255, 255, 0.09)');
      s.setProperty('--shadow', '0 6px 20px rgba(0, 0, 0, 0.35)');
      s.setProperty('--shadow-lg', '0 12px 32px rgba(0, 0, 0, 0.45)');
      s.setProperty('color-scheme', 'dark');
    } else {
      for (const p of ['--bg', '--card', '--surface-2', '--title', '--ink', '--muted', '--table-head', '--success', '--warning', '--danger', '--accent-dark', '--line', '--shadow', '--shadow-lg', 'color-scheme']) {
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
function mix(a: string, b: string, amount: number): string {
  const target = hexToRgb(b);
  return '#' + hexToRgb(a).map((c, i) => Math.round(c + (target[i] - c) * amount).toString(16).padStart(2, '0')).join('');
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function foreground(background: string): string {
  return contrast(background, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
}
function readable(color: string, surface: string): string {
  let result = color;
  const lighten = luminance(surface) < 0.5;
  for (let step = 0; step < 40 && contrast(result, surface) < 5; step++) {
    const channels = hexToRgb(result).map(c => Math.round(lighten ? c + (255 - c) * 0.12 : c * 0.88));
    result = `#${channels.map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }
  return result;
}
