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
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'apply/:slug',
    canActivate: [signedInGuard],
    loadComponent: () => import('./features/apply/apply.page').then((m) => m.ApplyPage),
  },
  {
    path: 'applications',
    canActivate: [signedInGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/applications/my-applications.page').then((m) => m.MyApplicationsPage),
      },
      {
        path: ':id/documents',
        loadComponent: () => import('./features/applications/documents.page').then((m) => m.DocumentsPage),
      },
      {
        path: ':id/payment',
        loadComponent: () => import('./features/applications/payment.page').then((m) => m.PaymentPage),
      },
    ],
  },
  {
    path: 'children',
    canActivate: [signedInGuard],
    loadComponent: () => import('./features/children/children.page').then((m) => m.ChildrenPage),
  },
  {
    path: 'inbox',
    canActivate: [signedInGuard],
    loadComponent: () => import('./features/inbox/inbox.page').then((m) => m.InboxPage),
  },
  { path: '**', redirectTo: '' },
];
