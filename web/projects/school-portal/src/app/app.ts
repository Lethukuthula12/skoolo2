import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService, FeedbackOutletComponent, SessionEndedComponent, ThemeService } from '@skoolo/shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SessionEndedComponent, FeedbackOutletComponent],
  template: `@if (auth.boundary()) { <skoolo-session-ended /> } @else { <router-outlet /><skoolo-feedback-outlet /> }`,
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  constructor() {
    effect(() => { if (this.auth.boundary()) this.theme.applyFromSchool(null); });
  }
}
