import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { StaffService } from './staff.service';

/** Portal routes that are enrolment or school administration: administrators only. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const staff = inject(StaffService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.isSignedIn()) return router.createUrlTree(['/sign-in']);
  if (!staff.loaded()) {
    await staff.loadSchools();
  }
  if (!auth.isSignedIn()) return router.createUrlTree(['/sign-in']);
  return staff.isAdmin() ? true : router.createUrlTree(['/home']);
};
