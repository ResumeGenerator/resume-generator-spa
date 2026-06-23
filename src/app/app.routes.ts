import { Routes } from '@angular/router';

import { LandingPage } from './landing-page/landing-page';
import { LoginPage } from './login-page/login-page';
import { ResumeUpload } from './resume-upload/resume-upload';

export const routes: Routes = [
  {
    path: '',
    component: LandingPage,
    title: 'ResumeAI',
  },
  {
    path: 'login',
    component: LoginPage,
    title: 'Sign In | ResumeAI',
  },
  {
    path: 'upload',
    component: ResumeUpload,
    title: 'Resume Upload',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
