import { Component, inject, signal } from '@angular/core';
import { DEFAULT_THEME, PRIMARY_SWATCHES, SIDEBAR_SWATCHES, StaffService, Theme, ThemeService } from '@skoolo/shared';

@Component({
  selector: 'app-theme-customizer',
  template: `
    <button class="fab" type="button" (click)="toggle()" title="Pick your style" aria-label="Theme">
      <svg class="gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>

    @if (open()) {
      <div class="scrim" (click)="close()"></div>
      <aside class="drawer">
        <header>
          <strong>Pick your style</strong>
          <button class="x" type="button" (click)="close()" aria-label="Close">×</button>
        </header>
        <p class="hint">Choose your school's portal colours. Everyone at your school sees them.</p>

        <div class="section">
          <span class="lbl">Primary colour</span>
          <div class="swatches">
            @for (c of primarySwatches; track c) {
              <button class="sw" type="button" [style.background]="c" [class.sel]="working().primary === c" (click)="pick('primary', c)" [attr.aria-label]="c"></button>
            }
          </div>
        </div>

        <div class="section">
          <span class="lbl">Header bar</span>
          <div class="swatches">
            @for (c of primarySwatches; track c) {
              <button class="sw" type="button" [style.background]="c" [class.sel]="working().header === c" (click)="pick('header', c)" [attr.aria-label]="c"></button>
            }
          </div>
        </div>

        <div class="section">
          <span class="lbl">Sidebar</span>
          <div class="swatches">
            @for (c of sidebarSwatches; track c) {
              <button class="sw" type="button" [style.background]="c" [class.sel]="working().sidebar === c" (click)="pick('sidebar', c)" [attr.aria-label]="c"></button>
            }
          </div>
        </div>

        @if (saved()) { <p class="ok">Saved. Your school's portal now uses this theme.</p> }

        <div class="actions">
          <button class="btn btn-ghost btn-sm" type="button" (click)="resetDefault()">Reset to default</button>
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" type="button" (click)="save()" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save theme' }}</button>
        </div>
      </aside>
    }
  `,
  styles: `
    .fab {
      position: fixed; right: 20px; bottom: 20px; z-index: 40;
      width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer;
      background: var(--brand); color: #fff; display: grid; place-items: center;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
    }
    .gear { width: 24px; height: 24px; animation: cust-spin 7s linear infinite; }
    .fab:hover .gear { animation-duration: 1.4s; }
    @keyframes cust-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .gear { animation: none; } }

    .scrim { position: fixed; inset: 0; background: rgba(20, 20, 40, 0.25); z-index: 45; }
    .drawer {
      position: fixed; top: 0; right: 0; z-index: 46; width: min(340px, 90vw); height: 100vh;
      background: #fff; box-shadow: -8px 0 32px rgba(0, 0, 0, 0.18); padding: 20px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 16px;
    }
    .drawer header { display: flex; align-items: center; justify-content: space-between; }
    .drawer header strong { font-size: 1.15rem; color: var(--title); }
    .drawer .x { border: none; background: transparent; font-size: 1.6rem; line-height: 1; color: var(--muted); cursor: pointer; }
    .hint { margin: -8px 0 0; color: var(--muted); font-size: 0.88rem; }
    .section { display: grid; gap: 8px; }
    .lbl { font-size: 0.82rem; font-weight: 600; color: var(--muted); }
    .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
    .sw {
      width: 34px; height: 34px; border-radius: 9px; cursor: pointer;
      border: 2px solid var(--line); padding: 0; transition: transform 100ms ease;
      &:hover { transform: scale(1.08); }
      &.sel { border-color: var(--title); box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--brand); }
    }
    .actions { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 8px; }
    .spacer { flex: 1; }
  `,
})
export class ThemeCustomizerComponent {
  private readonly theme = inject(ThemeService);
  private readonly staff = inject(StaffService);

  protected readonly primarySwatches = PRIMARY_SWATCHES;
  protected readonly sidebarSwatches = SIDEBAR_SWATCHES;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly working = signal<Theme>({ ...this.theme.current() });

  protected toggle(): void {
    if (this.open()) { this.close(); return; }
    this.working.set({ ...this.theme.current() });
    this.saved.set(false);
    this.open.set(true);
  }

  protected close(): void {
    this.theme.resetPreview();
    this.open.set(false);
  }

  protected pick(key: keyof Theme, color: string): void {
    const next = { ...this.working(), [key]: color };
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
    this.busy.set(true);
    try {
      const school = await this.staff.saveTheme(this.working());
      this.theme.applyFromSchool(school);
      this.saved.set(true);
    } catch (err) {
      console.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
