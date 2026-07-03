import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: {
    getToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authService = {
      getToken: vi.fn(() => 'jwt-token'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
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
});
