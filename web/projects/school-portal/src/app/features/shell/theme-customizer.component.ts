import { Component, inject, signal } from '@angular/core';
import { PortalDrawerComponent } from '../../ui/portal-drawer.component';
import { ActionFeedbackComponent, DEFAULT_THEME, PRIMARY_SWATCHES, SIDEBAR_SWATCHES, StaffService, Theme, ThemeService } from '@skoolo/shared';

@Component({
  selector: 'app-theme-customizer',
  imports: [ActionFeedbackComponent, PortalDrawerComponent],
  template: `
    <skoolo-action-feedback [success]="saved() ? 'School appearance saved.' : null" [error]="error()" [pending]="busy()" />
    <button class="theme-trigger" type="button" (click)="toggle()" aria-label="School appearance" title="School appearance"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg></button>
    <app-portal-drawer title="School appearance" [open]="open()" [dismissible]="!busy()" (closed)="close()">
      <div class="theme-options"><p class="hint">Save your school’s colours and background mode for the portal and linked parents’ app. Previews stay here until you save.</p>

        <div class="section">
          <span class="lbl">Background</span>
          <div class="modes">
            <button class="mode" type="button" [disabled]="busy()" [attr.aria-pressed]="working().mode === 'light'" [class.sel]="working().mode === 'light'" (click)="setMode('light')">Light</button>
            <button class="mode" type="button" [disabled]="busy()" [attr.aria-pressed]="working().mode === 'dark'" [class.sel]="working().mode === 'dark'" (click)="setMode('dark')">Dark</button>
          </div>
        </div>

        <div class="section">
          <span class="lbl">Primary colour</span>
          <div class="swatches">
            @for (c of primarySwatches; track c) {
              <button class="sw" type="button" [disabled]="busy()" [attr.aria-pressed]="working().primary === c" [style.background]="c" [class.sel]="working().primary === c" (click)="pick('primary', c)" [attr.aria-label]="'Primary ' + c"></button>
            }
          </div>
        </div>

        <div class="section">
          <span class="lbl">Header bar</span>
          <div class="swatches">
            @for (c of headerSwatches; track c) {
              <button class="sw" type="button" [disabled]="busy()" [attr.aria-pressed]="working().header === c" [style.background]="c" [class.sel]="working().header === c" (click)="pick('header', c)" [attr.aria-label]="'Header ' + c"></button>
            }
          </div>
        </div>

        <div class="section">
          <span class="lbl">Sidebar / app navigation</span>
          <div class="swatches">
            @for (c of sidebarSwatches; track c) {
              <button class="sw" type="button" [disabled]="busy()" [attr.aria-pressed]="working().sidebar === c" [style.background]="c" [class.sel]="working().sidebar === c" (click)="pick('sidebar', c)" [attr.aria-label]="'Navigation ' + c"></button>
            }
          </div>
        </div>

        @if (saved()) { <p class="ok" role="status">Saved for the portal and parent app. Online parent apps update within 30 seconds while open, or when reopened.</p> }

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="actions">
          <button class="btn btn-ghost btn-sm" type="button" (click)="resetDefault()" [disabled]="busy()">Reset to default</button>
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" type="button" (click)="save()" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save theme' }}</button>
        </div>
      </div>
    </app-portal-drawer>
  `,
  styles: `
    .theme-trigger { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 12px; background: var(--header-control); color: var(--header-ink); cursor: pointer; }
    .theme-trigger svg { width: 22px; height: 22px; }
    .theme-options { display: grid; gap: 28px; }
    .hint { color: var(--muted); font-size: 13px; margin: 0; }
    .section { display: grid; gap: 12px; }
    .lbl { color: var(--title); font-size: 13px; font-weight: 600; }
    .modes { display: flex; gap: 10px; }
    .mode { flex: 1; min-height: 48px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: var(--ink); font: inherit; cursor: pointer; }
    .mode.sel { border-color: var(--brand-ink); color: var(--brand-ink); background: var(--brand-soft); }
    .swatches { display: flex; flex-wrap: wrap; gap: 12px; }
    .sw { width: 44px; height: 44px; border-radius: 12px; border: 2px solid var(--line); cursor: pointer; transition: transform 160ms; }
    .sw:hover { transform: translateY(-2px); }
    .sw.sel { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--brand-ink); }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; border-top: 1px solid var(--line); padding-top: 20px; }
    @media (prefers-reduced-motion: reduce) { .sw { transition: none; } }
  `,
})
export class ThemeCustomizerComponent {
  private readonly theme = inject(ThemeService);
  private readonly staff = inject(StaffService);

  protected readonly primarySwatches = PRIMARY_SWATCHES;
  protected readonly headerSwatches = ['#ffffff', ...PRIMARY_SWATCHES];
  protected readonly error = signal<string | null>(null);
  protected readonly sidebarSwatches = SIDEBAR_SWATCHES;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly working = signal<Theme>({ ...this.theme.current() });

  protected toggle(): void {
    if (this.open()) { this.close(); return; }
    this.working.set({ ...this.theme.current() });
    this.saved.set(false);
    this.error.set(null);
    this.open.set(true);
  }

  protected close(): void {
    if (this.busy()) return;
    this.theme.resetPreview();
    this.open.set(false);
  }

  protected pick(key: 'primary' | 'header' | 'sidebar', color: string): void {
    const next = { ...this.working(), [key]: color };
    this.working.set(next);
    this.saved.set(false);
    this.theme.preview(next);
  }

  protected setMode(mode: 'light' | 'dark'): void {
    const next: Theme = { ...this.working(), mode };
    this.working.set(next);
    this.saved.set(false);
    this.theme.preview(next);
  }

  protected resetDefault(): void {
    this.working.set({ ...DEFAULT_THEME });
    this.saved.set(false);
    this.theme.preview(DEFAULT_THEME);
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.saved.set(false);
    this.error.set(null);
    try {
      const school = await this.staff.saveTheme(this.working());
      this.theme.applyFromSchool(school);
      this.saved.set(true);
    } catch (err) {
      this.error.set('Your theme could not be saved. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
