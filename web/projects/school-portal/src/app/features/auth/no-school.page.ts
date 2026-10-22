import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, StaffService } from '@skoolo/shared';

@Component({
  selector: 'app-no-school-page',
  imports: [RouterLink],
  template: `
    <div class="wrap">
      <div class="card">
        <h1>No school linked to this account</h1>
        <p class="muted">
          You are signed in as <strong>{{ auth.user()?.email }}</strong>, but this account is not a staff member of
          any school on Skoolo yet.
        </p>
        <div class="row">
          <a class="btn btn-primary" routerLink="/join">I have an invite code</a>
          <a class="btn btn-outline" routerLink="/register-school">Put my school on Skoolo</a>
        </div>
        <button class="btn btn-outline" type="button" (click)="signOut()">Sign out</button>
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { max-width: 460px; display: grid; gap: 12px; }
  `,
})
export class NoSchoolPage {
  protected readonly auth = inject(AuthService);
  private readonly staff = inject(StaffService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.staff.reset();
    await this.router.navigateByUrl('/sign-in');
  }
}
