import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).getToken();

  if (!token || isAnonymousAuthRequest(request.url)) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};

function isAnonymousAuthRequest(url: string): boolean {
  return /\/api\/auth\/(?:login|register)(?:[?#]|$)/i.test(url);
}
