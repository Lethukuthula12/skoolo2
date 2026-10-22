import { Routes } from '@angular/router';
import { adminGuard, staffGuard } from '@skoolo/shared';

export const routes: Routes = [
  { path: 'sign-in', loadComponent: () => import('./features/auth/sign-in.page').then((m) => m.SignInPage) },
  { path: 'no-school', loadComponent: () => import('./features/auth/no-school.page').then((m) => m.NoSchoolPage) },
  { path: 'join', loadComponent: () => import('./features/auth/join.page').then((m) => m.JoinPage) },
  { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage) },
  { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage) },
  { path: 'register-school', loadComponent: () => import('./features/auth/register-school.page').then((m) => m.RegisterSchoolPage) },
  {
    path: '',
    canActivate: [staffGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'applications' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'applications',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/applications/applications-list.page').then((m) => m.ApplicationsListPage),
      },
      {
        path: 'applications/:id',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/applications/application-detail.page').then((m) => m.ApplicationDetailPage),
      },
      {
        path: 'enrolment',
        loadComponent: () => import('./features/enrolment/enrolment-settings.page').then((m) => m.EnrolmentSettingsPage),
      },
      {
        path: 'classes',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/classes/classes.page').then((m) => m.ClassesPage),
      },
      {
        path: 'learners',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/learners/learners.page').then((m) => m.LearnersPage),
      },
      {
        path: 'staff',
        loadComponent: () => import('./features/staff/staff-register.page').then((m) => m.StaffRegisterPage),
      },
      {
        path: 'school',
        loadComponent: () => import('./features/school/school-profile.page').then((m) => m.SchoolProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
