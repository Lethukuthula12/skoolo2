import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { IonApp, IonIcon, IonRouterOutlet } from '@ionic/angular/standalone';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '@skoolo/shared';
import { SchoolThemeService } from './school-theme.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonIcon, IonRouterOutlet, RouterLink],
  template: `
    <ion-app>
      <ion-router-outlet [style.bottom]="showNavigation() ? 'var(--parent-nav-height)' : '0'" />
      @if (showNavigation()) {
        <nav class="parent-nav" aria-label="Main navigation">
          @for (item of navigation; track item.id) {
            <a [routerLink]="item.link" [class.active]="activeSection() === item.id"
               [attr.aria-current]="activeSection() === item.id ? 'page' : null">
              <span class="nav-icon"><ion-icon [name]="item.icon" aria-hidden="true" /></span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
      }
    </ion-app>
  `,
  styles: `
    .parent-nav { position: absolute; inset: auto 0 0; z-index: 20; height: var(--parent-nav-height);
      padding: 8px max(12px, calc((100vw - 600px) / 2)) calc(8px + env(safe-area-inset-bottom, 0px));
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); background: var(--skoolo-surface);
      border-top: 1px solid var(--skoolo-line); box-shadow: 0 -4px 24px rgba(39, 40, 71, .035); }
    a { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
      color: var(--skoolo-muted); font-size: 11px; font-weight: 500; text-decoration: none; min-height: 48px; }
    .nav-icon { display: grid; place-items: center; width: 52px; height: 28px; border-radius: 10px; transition: background 180ms ease; }
    ion-icon { font-size: 22px; }
    a.active { color: var(--skoolo-brand-ink); font-weight: 600; }
    a.active .nav-icon { background: rgba(var(--ion-color-primary-rgb), .10); }
    a:focus-visible { outline: 2px solid var(--skoolo-brand-ink); outline-offset: -2px; border-radius: 10px; }
    @media (prefers-reduced-motion: reduce) { .nav-icon { transition: none; } }
  `,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly theme = inject(SchoolThemeService);
  private readonly url = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects), startWith(this.router.url),
  ), { initialValue: this.router.url });

  protected readonly navigation = [
    { id: 'home', label: 'Home', link: '/children', icon: 'home-outline' },
    { id: 'applications', label: 'Applications', link: '/applications', icon: 'folder-open-outline' },
    { id: 'inbox', label: 'Inbox', link: '/inbox', icon: 'mail-outline' },
    { id: 'account', label: 'Account', link: '/auth', icon: 'person-circle-outline' },
  ];
  protected readonly showNavigation = computed(() => this.auth.isSignedIn() &&
    !this.auth.isPasswordRecovery() && !/\/(forgot-password|reset-password)/.test(this.url()));
  protected readonly activeSection = computed(() => {
    const path = this.url().split('?')[0];
    if (path === '/auth') return 'account';
    if (/^\/(applications|apply|schools)(\/|$)/.test(path)) return 'applications';
    if (path === '/inbox') return 'inbox';
    return 'home';
  });

  constructor() {
    effect(() => {
      if (this.auth.user()) void this.theme.refreshForParent();
      else if (this.auth.ready()) this.theme.reset();
    });
  }
}
