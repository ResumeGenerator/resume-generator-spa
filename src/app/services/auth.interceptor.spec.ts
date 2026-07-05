import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: {
    getToken: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let router: {
    navigate: ReturnType<typeof vi.fn>;
    url: string;
  };

  beforeEach(() => {
    authService = {
      getToken: vi.fn(() => 'jwt-token'),
      logout: vi.fn(),
    };
    router = {
      navigate: vi.fn(),
      url: '/upload',
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('adds the bearer token to backend requests', () => {
    http.get('/api/resumes').subscribe();

    const request = httpTesting.expectOne('/api/resumes');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token');

    request.flush({});
  });

  it('adds the bearer token to authenticated auth requests', () => {
    http.get('/api/auth/me').subscribe();

    const request = httpTesting.expectOne('/api/auth/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token');

    request.flush({});
  });

  it('does not add the bearer token to login or register requests', () => {
    http.post('/api/auth/login', {}).subscribe();
    http.post('/api/auth/register?source=spa', {}).subscribe();

    const loginRequest = httpTesting.expectOne('/api/auth/login');
    expect(loginRequest.request.headers.has('Authorization')).toBe(false);
    loginRequest.flush({});

    const registerRequest = httpTesting.expectOne('/api/auth/register?source=spa');
    expect(registerRequest.request.headers.has('Authorization')).toBe(false);
    registerRequest.flush({});
  });

  it('leaves requests unchanged when there is no token', () => {
    authService.getToken.mockReturnValue(null);

    http.get('/api/resumes').subscribe();

    const request = httpTesting.expectOne('/api/resumes');
    expect(request.request.headers.has('Authorization')).toBe(false);

    request.flush({});
  });

  it('logs out and redirects to login when an authenticated request is unauthorized', () => {
    let observedError: unknown;

    http.get('/api/resumes').subscribe({
      error: (error: unknown) => {
        observedError = error;
      },
    });

    const request = httpTesting.expectOne('/api/resumes');
    request.flush(
      { message: 'Token expired' },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );

    expect(observedError).toBeTruthy();
    expect(authService.logout).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: {
        authError: 'session-expired',
        returnUrl: '/upload',
      },
    });
  });

  it('does not redirect when an anonymous login request is unauthorized', () => {
    http.post('/api/auth/login', {}).subscribe({
      error: () => undefined,
    });

    const request = httpTesting.expectOne('/api/auth/login');
    request.flush(
      { message: 'Invalid credentials' },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );

    expect(authService.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
