import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { DEFAULT_THEME, normalizeTheme, Theme } from './theme.model';
import { themeRgb as hexToRgb, themeMix as mix, themeContrast as contrast, themeForeground as foreground, readableThemeColor as readable } from './theme-colors';
export { DEFAULT_THEME, normalizeTheme } from './theme.model';
export type { Theme } from './theme.model';

/** Swatches offered in the customizer. */
export const PRIMARY_SWATCHES = ['#3a41c4', '#5b4bd6', '#6610f2', '#00ada3', '#1f6fe8', '#1e8e5a', '#e2544b', '#fb7d5b', '#c3891c', '#14213d'];
export const SIDEBAR_SWATCHES = ['#22223d', '#1a1a28', '#1e1a46', '#0b3d3a', '#2b2f45', '#3b2a24', '#14213d', '#ffffff'];

const CACHE_KEY = 'skoolo-portal-theme';

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
    return normalizeTheme(value);
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

function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
