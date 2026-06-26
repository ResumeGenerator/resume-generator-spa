import { Routes } from '@angular/router';

import { AuthCallback } from './auth-callback/auth-callback';
import { LandingPage } from './landing-page/landing-page';
import { LoginPage } from './login-page/login-page';
import { ResumeUpload } from './resume-upload/resume-upload';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: LandingPage,
    title: 'CareerKit AI',
  },
  {
    path: 'login',
    component: LoginPage,
    title: 'Sign In | CareerKit AI',
  },
  {
    path: 'auth/auth-callback',
    component: AuthCallback,
    title: 'Signing In | CareerKit AI',
  },
  {
    path: 'upload',
    component: ResumeUpload,
    canActivate: [authGuard],
    title: 'Resume Upload',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
