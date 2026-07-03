import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';

interface RuntimeConfigWindow extends Window {
  __RESUME_GENERATOR_CONFIG__?: {
    apiGatewayUrl?: string;
    authApiUrl?: string;
    authRedirectUri?: string;
  };
}

describe('AuthService', () => {
  let authService: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    (window as RuntimeConfigWindow).__RESUME_GENERATOR_CONFIG__ = {
      apiGatewayUrl: 'https://gateway.example.test',
      authApiUrl: 'https://auth.example.test',
      authRedirectUri: 'https://spa.example.test/auth/auth-callback',
    };

    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });

    authService = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
    delete (window as RuntimeConfigWindow).__RESUME_GENERATOR_CONFIG__;
  });

  it('routes auth requests through the API gateway when configured', () => {
    expect(authService.googleLoginUrl).toBe(
      'https://gateway.example.test/api/auth/google-login?redirectUri=https%3A%2F%2Fspa.example.test%2Fauth%2Fauth-callback',
    );

    authService.login('candidate@example.test', 'password').subscribe();

    const loginRequest = httpTesting.expectOne('https://gateway.example.test/api/auth/login');
    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.body).toEqual({
      email: 'candidate@example.test',
      password: 'password',
    });

    loginRequest.flush({ token: 'token-value' });

    authService.getCurrentUser().subscribe();

    const currentUserRequest = httpTesting.expectOne('https://gateway.example.test/api/auth/me');
    expect(currentUserRequest.request.method).toBe('GET');

    currentUserRequest.flush({
      email: 'candidate@example.test',
      displayName: 'Candidate',
    });
  });
});
