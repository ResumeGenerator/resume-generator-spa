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
  fullName?: string;
  userName?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  [key: string]: unknown;
}

interface JwtClaims {
  email?: string;
  displayName?: string;
  exp?: number | string;
  fullName?: string;
  userName?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  unique_name?: string;
  preferred_username?: string;
  sub?: string;
  [key: string]: unknown;
}

const NAME_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
const EMAIL_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
const GIVEN_NAME_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname';
const SURNAME_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname';
const USER_ID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

interface RuntimeConfigWindow extends Window {
  __RESUME_GENERATOR_CONFIG__?: {
    apiGatewayUrl?: string;
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
  private readonly runtimeConfig = (window as RuntimeConfigWindow).__RESUME_GENERATOR_CONFIG__;
  private readonly apiGatewayUrl = this.resolveOptionalBaseUrl(this.runtimeConfig?.apiGatewayUrl);
  private readonly authApiUrl = this.resolveBaseUrl(
    this.apiGatewayUrl ?? this.runtimeConfig?.authApiUrl,
    window.location.origin,
  );
  private readonly authRedirectUri =
    this.runtimeConfig?.authRedirectUri?.trim() || `${window.location.origin}/auth/auth-callback`;
  private readonly initialToken = this.resolveInitialToken();
  private readonly authenticated = signal(Boolean(this.initialToken));
  readonly currentUser = signal<CurrentUser | null>(this.getUserFromToken(this.initialToken));

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
    this.currentUser.set(null);
  }

  getCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.authApiUrl}/api/auth/me`);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  getToken(): string | null {
    const token = localStorage.getItem(this.tokenStorageKey);

    if (!token) {
      this.authenticated.set(false);
      this.currentUser.set(null);
      return null;
    }

    if (this.isTokenExpired(token)) {
      this.logout();
      return null;
    }

    this.authenticated.set(true);

    if (!this.currentUser()) {
      this.currentUser.set(this.getUserFromToken(token));
    }

    return token;
  }

  getCurrentUserId(): string {
    return this.resolveUserId(this.currentUser());
  }

  storeToken(token: string): void {
    if (this.isTokenExpired(token)) {
      this.logout();
      return;
    }

    localStorage.setItem(this.tokenStorageKey, token);
    this.authenticated.set(true);
    this.currentUser.set(this.getUserFromToken(token));
  }

  refreshCurrentUser(): Observable<CurrentUser> {
    return this.getCurrentUser().pipe(
      tap((user) => {
        const existingUserId = this.getCurrentUserId();
        const normalizedUser = this.normalizeUser(user);

        this.currentUser.set({
          ...normalizedUser,
          id: normalizedUser.id || existingUserId,
        });
      }),
    );
  }

  private resolveBaseUrl(value: string | undefined, fallback: string): string {
    const resolved = value?.trim() || fallback;
    const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(resolved) ? resolved : `https://${resolved}`;
    return withProtocol.replace(/\/+$/, '');
  }

  private resolveOptionalBaseUrl(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? this.resolveBaseUrl(trimmed, trimmed) : undefined;
  }

  private resolveInitialToken(): string | null {
    const token = localStorage.getItem(this.tokenStorageKey);

    if (!token) {
      return null;
    }

    if (this.isTokenExpired(token)) {
      localStorage.removeItem(this.tokenStorageKey);
      return null;
    }

    return token;
  }

  private getUserFromToken(token = this.getToken()): CurrentUser | null {
    const claims = this.decodeJwtClaims(token);

    if (!claims) {
      return null;
    }

    return this.normalizeUser({
      id: this.firstString(claims['sub'], claims[USER_ID_CLAIM], claims['userId'], claims['uid'], claims['oid']),
      email: this.firstString(claims['email'], claims[EMAIL_CLAIM], claims['unique_name'], claims['preferred_username']),
      displayName: this.firstString(
        claims['displayName'],
        claims['display_name'],
        claims['name'],
        claims[NAME_CLAIM],
        claims['fullName'],
        claims['full_name'],
        claims['userName'],
        claims['user_name'],
        this.joinName(claims['givenName'], claims['familyName']),
        this.joinName(claims[GIVEN_NAME_CLAIM], claims[SURNAME_CLAIM]),
        claims['unique_name'],
        claims['preferred_username'],
      ),
      fullName: this.asString(claims['fullName']),
      userName: this.asString(claims['userName']),
      name: this.asString(claims['name']),
      givenName: this.firstString(claims['givenName'], claims[GIVEN_NAME_CLAIM]),
      familyName: this.firstString(claims['familyName'], claims[SURNAME_CLAIM]),
    });
  }

  private normalizeUser(user: CurrentUser): CurrentUser {
    const id = this.resolveUserId(user);
    const email = this.firstString(user.email, user['Email'], user['emailAddress'], user['mail'], user[EMAIL_CLAIM]);
    const displayName = this.firstString(
      user.displayName,
      user['display_name'],
      user['DisplayName'],
      user.name,
      user['Name'],
      user[NAME_CLAIM],
      user.fullName,
      user['full_name'],
      user['FullName'],
      user.userName,
      user['user_name'],
      user['UserName'],
      this.joinName(user.givenName ?? user['given_name'] ?? user['firstName'], user.familyName ?? user['family_name'] ?? user['lastName']),
      this.joinName(user[GIVEN_NAME_CLAIM], user[SURNAME_CLAIM]),
    );

    return {
      ...user,
      id,
      email,
      displayName,
    };
  }

  private resolveUserId(user: CurrentUser | null): string {
    if (!user) {
      return '';
    }

    return this.firstString(
      user.id,
      user['Id'],
      user['userId'],
      user['UserId'],
      user['uid'],
      user['oid'],
      user['sub'],
      user[USER_ID_CLAIM],
    );
  }

  private decodeJwtClaims(token: string | null): JwtClaims | null {
    const payload = token?.split('.')[1];

    if (!payload) {
      return null;
    }

    try {
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
      return JSON.parse(atob(paddedPayload)) as JwtClaims;
    } catch {
      return null;
    }
  }

  private firstString(...values: unknown[]): string {
    return values.map((value) => this.asString(value)).find(Boolean) || '';
  }

  private isTokenExpired(token: string): boolean {
    const claims = this.decodeJwtClaims(token);
    const expiresAt = this.asExpirationTime(claims?.exp);

    return expiresAt !== null && expiresAt <= Date.now();
  }

  private asExpirationTime(value: unknown): number | null {
    const seconds =
      typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;

    return Number.isFinite(seconds) ? seconds * 1000 : null;
  }

  private joinName(first: unknown, last: unknown): string {
    return [this.asString(first), this.asString(last)].filter(Boolean).join(' ');
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
