import { Routes } from '@angular/router';
import { staffGuard } from '@skoolo/shared';

export const routes: Routes = [
  { path: 'sign-in', loadComponent: () => import('./features/auth/sign-in.page').then((m) => m.SignInPage) },
  { path: 'no-school', loadComponent: () => import('./features/auth/no-school.page').then((m) => m.NoSchoolPage) },
  {
    path: '',
    canActivate: [staffGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'applications' },
      {
        path: 'applications',
        loadComponent: () => import('./features/applications/applications-list.page').then((m) => m.ApplicationsListPage),
      },
      {
        path: 'applications/:id',
        loadComponent: () => import('./features/applications/application-detail.page').then((m) => m.ApplicationDetailPage),
      },
      {
        path: 'enrolment',
        loadComponent: () => import('./features/enrolment/enrolment-settings.page').then((m) => m.EnrolmentSettingsPage),
      },
      {
        path: 'school',
        loadComponent: () => import('./features/school/school-profile.page').then((m) => m.SchoolProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
