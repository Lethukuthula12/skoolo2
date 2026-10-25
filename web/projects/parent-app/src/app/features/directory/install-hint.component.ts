import { Component, computed, inject, input } from '@angular/core';
import { AppInstallService } from '../../app-install.service';

@Component({
  selector: 'app-install-hint',
  template: `
    @if (visible()) {
      <section class="install-card" aria-label="Install Skoolo">
        <div class="intro">
          <span class="app-mark" aria-hidden="true">s<span>.</span></span>
          <div class="copy"><h2>Skoolo, one tap away.</h2><p>Add Skoolo to your home screen for easy access.</p></div>
          @if (!alwaysVisible()) {
            <button class="dismiss" type="button" (click)="install.dismiss()" aria-label="Dismiss installation suggestion">×</button>
          }
        </div>
        @if (install.canInstall() || install.busy()) {
          <button class="install-button" type="button" [disabled]="install.busy()" (click)="install.install()">
            {{ install.busy() ? 'Opening installation…' : 'Install Skoolo' }}
          </button>
        }
        @if (install.message()) { <p class="message" role="status">{{ install.message() }}</p> }
        <details>
          <summary>{{ install.isIos ? 'Add to your iPhone or iPad' : 'Installation steps' }}</summary>
          @if (install.isIos) {
            <ol>
              <li>Open <strong>app.skoolo.co.za</strong> in <strong>Safari</strong>.</li>
              <li>Tap <strong>Share</strong> (you may find it in the page menu), then <strong>Add to Home Screen</strong>.</li>
              <li>Leave <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li>
              <li>Open <strong>Skoolo</strong> from your home screen.</li>
            </ol>
          } @else if (install.isAndroid) {
            <ol>
              <li>Open <strong>app.skoolo.co.za</strong> in <strong>Chrome</strong>.</li>
              <li>Tap the <strong>⋮ menu</strong>, then <strong>Install and create shortcut</strong> or <strong>Add to Home screen</strong>.</li>
              <li>Choose <strong>Install</strong> if offered, then open <strong>Skoolo</strong> from your home screen.</li>
            </ol>
            <p class="help">Use a regular Chrome tab. If you opened the link inside another app, open it in Chrome first. Already installed? Look for Skoolo on your phone.</p>
          } @else {
            <p class="help">Use your browser's install button in the address bar or its menu to add Skoolo.</p>
          }
          <p class="help">School information and account actions still need an internet connection.</p>
        </details>
      </section>
    }
  `,
  styles: `
    :host { display: block; }
    .install-card { max-width: 720px; margin: 16px auto; padding: 18px; border: 1px solid var(--skoolo-line);
      border-radius: 20px; background: var(--skoolo-brand-soft); color: var(--skoolo-title); }
    .intro { display: flex; align-items: center; gap: 12px; }
    .app-mark { display: grid; place-content: center; position: relative; flex: 0 0 44px; height: 44px;
      border-radius: 13px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); font-size: 30px; font-weight: 800; }
    .app-mark span { position: absolute; right: 7px; bottom: 2px; color: #ffca42; }
    .copy { flex: 1; min-width: 0; }
    h2 { margin: 0 0 4px; font-size: 1rem; font-weight: 600; }
    p { margin: 0; font-size: .82rem; line-height: 1.5; }
    button, summary { font: inherit; }
    button { cursor: pointer; }
    .dismiss { align-self: flex-start; flex: 0 0 44px; min-height: 44px; margin: -8px -8px 0 0;
      border: 0; background: transparent; color: inherit; font-size: 26px; border-radius: 10px; }
    .install-button { display: block; width: 100%; min-height: 44px; margin-top: 16px; padding: 10px 16px;
      border: 0; border-radius: 12px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); font-size: .9rem; font-weight: 600; }
    .install-button:disabled { opacity: .65; cursor: wait; }
    details { margin-top: 10px; font-size: .83rem; }
    summary { cursor: pointer; min-height: 44px; padding: 12px 0; color: var(--skoolo-brand-ink); font-weight: 600; }
    ol { margin: 0; padding-left: 20px; line-height: 1.6; }
    li + li { margin-top: 8px; }
    .help, .message { margin-top: 12px; }
    :is(button, summary):focus-visible { outline: 2px solid var(--skoolo-brand-ink); outline-offset: 3px; }
    @media (max-width: 760px) { .install-card { margin: 12px; } }
  `,
})
export class InstallHintComponent {
  protected readonly install = inject(AppInstallService);
  readonly alwaysVisible = input(false);
  protected readonly visible = computed(() => this.install.canOffer()
    && (this.alwaysVisible() || !this.install.dismissed()));
}
