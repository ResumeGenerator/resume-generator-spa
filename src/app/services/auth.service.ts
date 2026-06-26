import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface AuthTokenResponse {
  token: string;
}

export interface CurrentUser {
  id?: string;
  email?: string;
  displayName?: string;
  name?: string;
  [key: string]: unknown;
}

interface RuntimeConfigWindow extends Window {
  __RESUME_GENERATOR_CONFIG__?: {
    parserApiUrl?: string;
    templateApiUrl?: string;
    authApiUrl?: string;
    authRedirectUri?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly tokenStorageKey = 'resumeGeneratorAuthToken';
  private readonly authApiUrl = this.resolveBaseUrl(
    (window as RuntimeConfigWindow).__RESUME_GENERATOR_CONFIG__?.authApiUrl,
    'https://resume-generator-auth-api-staging.up.railway.app',
  );
  private readonly authRedirectUri =
    (window as RuntimeConfigWindow).__RESUME_GENERATOR_CONFIG__?.authRedirectUri?.trim() ||
    `${window.location.origin}/auth/auth-callback`;
  private readonly authenticated = signal(Boolean(this.getToken()));

  readonly googleLoginUrl = `${this.authApiUrl}/api/auth/google-login?redirectUri=${encodeURIComponent(
    this.authRedirectUri,
  )}`;

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<AuthTokenResponse> {
    return this.http
      .post<AuthTokenResponse>(`${this.authApiUrl}/api/auth/login`, {
        email,
        password,
      })
      .pipe(tap((response) => this.storeToken(response.token)));
  }

  register(email: string, password: string, displayName: string): Observable<AuthTokenResponse> {
    return this.http
      .post<AuthTokenResponse>(`${this.authApiUrl}/api/auth/register`, {
        email,
        password,
        displayName,
      })
      .pipe(tap((response) => this.storeToken(response.token)));
  }

  logout(): void {
    localStorage.removeItem(this.tokenStorageKey);
    this.authenticated.set(false);
  }

  getCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.authApiUrl}/api/auth/me`);
  }

  isAuthenticated(): boolean {
    return this.authenticated();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  storeToken(token: string): void {
    localStorage.setItem(this.tokenStorageKey, token);
    this.authenticated.set(true);
  }

  private resolveBaseUrl(value: string | undefined, fallback: string): string {
    const resolved = value?.trim() || fallback;
    const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(resolved) ? resolved : `https://${resolved}`;
    return withProtocol.replace(/\/+$/, '');
  }
}
