import { Component, inject } from '@angular/core';
import { AuthService, StaffService } from '@skoolo/shared';

/** Where a signed-in teacher lands. Teachers have no enrolment access; their tools come later. */
@Component({
  selector: 'app-home-page',
  template: `
    <div class="stack">
      <div>
        <h1>Welcome, {{ name() }}</h1>
        <p class="muted">{{ staff.currentSchool()?.name }}</p>
      </div>
      <div class="card">
        <h2>Your tools are on the way</h2>
        <p class="muted">
          Your class register, learner marks, timetable and messages to parents will appear here as they
          are built. There is nothing for you to do in the portal just yet.
        </p>
        <p class="muted small">Enrolment and school settings are handled by the school's administrators.</p>
      </div>
    </div>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  protected readonly staff = inject(StaffService);

  protected name(): string {
    const meta = this.auth.user()?.user_metadata ?? {};
    return (meta['full_name'] as string | undefined) || this.auth.user()?.email || 'there';
  }
}
