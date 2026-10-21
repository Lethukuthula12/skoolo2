import { Routes } from '@angular/router';
import { signedInGuard } from '@skoolo/shared';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/directory/school-directory.page').then((m) => m.SchoolDirectoryPage),
  },
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'apply/:slug',
    canActivate: [signedInGuard],
    loadComponent: () => import('./features/apply/apply.page').then((m) => m.ApplyPage),
  },
  { path: '**', redirectTo: '' },
];
