import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, inject } from '@angular/core';
import {
  ApplicationService, DEFAULT_THEME, normalizeTheme, readableThemeColor,
  Theme, themeContrast, themeForeground, themeMix, themeRgb,
} from '@skoolo/shared';

const CACHE_KEY = 'skoolo-app-theme';
const LEGACY_CACHE_KEY = 'skoolo-app-primary';
const REFRESH_INTERVAL = 30_000;

/** The saved school theme drives both apps; unsaved portal previews stay in the portal. */
@Injectable({ providedIn: 'root' })
export class SchoolThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly applications = inject(ApplicationService);
  private requestVersion = 0;
  private pendingVersion: number | null = null;

  constructor() {
    this.apply(this.read() ?? DEFAULT_THEME);
  }

  /** Runs only for a signed-in parent. Resume/focus refresh immediately; visible apps poll. */
  watchForParent(): () => void {
    const view = this.doc.defaultView;
    const refresh = () => {
      if (this.doc.visibilityState !== 'hidden' && this.pendingVersion === null) {
        void this.refreshForParent();
      }
    };
    // Polling outside Angular avoids keeping application stability/service-worker setup pending.
    const timer = this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('visibilitychange', refresh);
      view?.addEventListener('focus', refresh);
      refresh();
      return view?.setInterval(refresh, REFRESH_INTERVAL);
    });
    return () => {
      if (timer !== undefined) view?.clearInterval(timer);
      this.doc.removeEventListener('visibilitychange', refresh);
      view?.removeEventListener('focus', refresh);
      ++this.requestVersion;
      this.pendingVersion = null;
    };
  }

  /** Also called after connecting a child, superseding any earlier school lookup. */
  async refreshForParent(): Promise<void> {
    const version = ++this.requestVersion;
    this.pendingVersion = version;
    try {
      const theme = await this.applications.mySchoolTheme();
      if (version !== this.requestVersion) return;
      this.apply(normalizeTheme(theme));
    } catch {
      // An offline app keeps its last saved theme; the next foreground refresh retries.
    } finally {
      if (this.pendingVersion === version) this.pendingVersion = null;
    }
  }

  reset(): void {
    ++this.requestVersion;
    this.pendingVersion = null;
    this.apply(DEFAULT_THEME);
  }

  private apply(theme: Theme): void {
    const style = this.doc.documentElement.style;
    const set = (key: string, value: string) => style.setProperty(key, value);
    const dark = theme.mode === 'dark';
    const background = dark ? '#15162b' : '#e9edf2';
    const surface = dark ? '#20223c' : '#ffffff';
    const text = dark ? '#eef0fb' : '#303972';
    const surface2 = dark ? '#2a2c48' : '#f6f6fb';
    const softSurface = themeMix(surface, theme.primary, dark ? .18 : .09);
    const readable = (color: string) => [background, surface, surface2, softSurface].reduce(
      (ink, on) => themeContrast(ink, on) >= 4.5 ? ink : readableThemeColor(ink, on), color);
    const muted = readable(dark ? '#acb1cc' : '#697087');
    const line = dark ? '#3c3e5a' : '#e9e9f2';
    const ionicColor = (name: string, color: string) => {
      const prefix = `--ion-color-${name}`;
      const ink = themeForeground(color);
      set(prefix, color);
      set(`${prefix}-rgb`, themeRgb(color).join(', '));
      set(`${prefix}-contrast`, ink);
      set(`${prefix}-contrast-rgb`, themeRgb(ink).join(', '));
      set(`${prefix}-shade`, themeMix(color, '#000000', .12));
      set(`${prefix}-tint`, themeMix(color, '#ffffff', .1));
    };
    ionicColor('primary', theme.primary);
    ionicColor('secondary', dark ? '#ffae96' : '#bf543c');
    ionicColor('success', dark ? '#74d6a6' : '#247650');
    ionicColor('warning', dark ? '#f6cc76' : '#8c631e');
    ionicColor('danger', dark ? '#ff919c' : '#b73647');
    ionicColor('medium', muted);
    ionicColor('light', dark ? '#2a2c48' : '#f6f6fb');
    ionicColor('dark', text);
    set('color-scheme', theme.mode);
    set('--ion-background-color', background);
    set('--ion-background-color-rgb', themeRgb(background).join(', '));
    set('--ion-text-color', text);
    set('--ion-text-color-rgb', themeRgb(text).join(', '));
    set('--ion-item-background', surface);
    set('--ion-card-background', surface);
    set('--ion-card-color', text);
    set('--ion-border-color', line);
    // Ionic overlays, form controls and secondary text use these stepped colours.
    for (let step = 50; step < 1000; step += 50) {
      set(`--ion-background-color-step-${step}`, themeMix(background, text, step / 1000));
      set(`--ion-text-color-step-${step}`, themeMix(text, background, step / 1000));
    }
    set('--skoolo-title', text);
    set('--skoolo-muted', muted);
    set('--skoolo-surface', surface);
    set('--skoolo-surface-2', surface2);
    set('--skoolo-line', line);
    set('--skoolo-control-border', dark ? '#626681' : '#dcdde8');
    set('--skoolo-shadow', dark ? '0 4px 24px rgba(0,0,0,.18)' : '0 4px 24px rgba(48,57,114,.025)');
    set('--skoolo-brand-soft', `rgba(${themeRgb(theme.primary).join(', ')}, ${dark ? '.18' : '.09'})`);
    set('--skoolo-brand-ink', readable(theme.primary));

    const headerInk = themeContrast('#303972', theme.header) >= 4.5 ? '#303972' : themeForeground(theme.header);
    set('--skoolo-header-bg', theme.header);
    set('--skoolo-header-ink', headerInk);
    set('--skoolo-header-control', headerInk === '#ffffff' ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.65)');
    const navInk = themeForeground(theme.sidebar);
    const navActive = themeMix(theme.sidebar, navInk === '#ffffff' ? '#ffffff' : '#000000', .14);
    set('--skoolo-nav-bg', theme.sidebar);
    set('--skoolo-nav-ink', navInk);
    set('--skoolo-nav-active', navActive);
    set('--skoolo-nav-active-ink', themeForeground(navActive));
    try {
      this.doc.defaultView?.localStorage.setItem(CACHE_KEY, JSON.stringify(theme));
      this.doc.defaultView?.localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch { /* Storage may be blocked; the theme still applies to this session. */ }
  }

  private read(): Theme | null {
    try {
      const storage = this.doc.defaultView?.localStorage;
      const raw = storage?.getItem(CACHE_KEY);
      if (raw) return normalizeTheme(JSON.parse(raw));
      const primary = storage?.getItem(LEGACY_CACHE_KEY);
      return primary ? normalizeTheme({ primary }) : null;
    } catch {
      return null;
    }
  }
}
