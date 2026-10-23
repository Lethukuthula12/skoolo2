import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@skoolo/shared';

/** The directory is the landing for signed-out visitors; a signed-in parent goes straight to their
 *  children instead of the list of schools. */
export const parentHomeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.user() ? router.createUrlTree(['/children']) : true;
};
