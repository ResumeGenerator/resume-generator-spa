import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();
  const requiresAuth = !isAnonymousAuthRequest(request.url);
  const authenticatedRequest =
    token && requiresAuth
      ? request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (requiresAuth && error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();
        void router.navigate(['/login'], {
          queryParams: sessionExpiredQueryParams(router.url),
        });
      }

      return throwError(() => error);
    }),
  );
};

function isAnonymousAuthRequest(url: string): boolean {
  return /\/api\/auth\/(?:login|register)(?:[?#]|$)/i.test(url);
}

function sessionExpiredQueryParams(currentUrl: string): { authError: string; returnUrl?: string } {
  const queryParams: { authError: string; returnUrl?: string } = {
    authError: 'session-expired',
  };

  if (currentUrl && !currentUrl.startsWith('/login') && !currentUrl.startsWith('/auth/auth-callback')) {
    queryParams.returnUrl = currentUrl;
  }

  return queryParams;
}
