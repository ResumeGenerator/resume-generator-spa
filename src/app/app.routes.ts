import { Routes } from '@angular/router';

import { ResumeUpload } from './resume-upload/resume-upload';

export const routes: Routes = [
  {
    path: '',
    component: ResumeUpload,
    title: 'Resume Upload',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
