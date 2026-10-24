import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { StaffService } from './staff.service';

/** Portal routes: must be signed in and linked to at least one school. */
export const staffGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const staff = inject(StaffService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.isSignedIn()) {
    return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
  }
  if (!staff.loaded()) {
    await staff.loadSchools();
  }
  if (staff.schools().length === 0) {
    return router.createUrlTree(['/no-school']);
  }
  // Registration recovery may need a full page load. Restore its destination school only
  // from the signed-in user's own memberships, never from an unchecked URL value.
  const requestedSchool = _route.queryParamMap.get('school');
  if (requestedSchool && staff.schools().some(school => school.id === requestedSchool)) {
    staff.currentSchoolId.set(requestedSchool);
  }
  return true;
};
