import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService, SessionEndedComponent, ThemeService } from '@skoolo/shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SessionEndedComponent],
  template: `@if (auth.boundary()) { <skoolo-session-ended /> } @else { <router-outlet /> }`,
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  constructor() {
    effect(() => { if (this.auth.boundary()) this.theme.applyFromSchool(null); });
  }
}
