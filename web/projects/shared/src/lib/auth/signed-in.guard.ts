import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Sends anonymous users to /auth and brings them back afterwards. */
export const signedInGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.isSignedIn()) {
    return true;
  }
  return router.createUrlTree(['/auth'], { queryParams: { returnUrl: state.url } });
};
