import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { LoginPage } from './login-page';

type TestableLoginPage = {
  email: string;
  errorMessage: string;
  isSubmitting: boolean;
  password: string;
};

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let authService: {
    googleLoginUrl: string;
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authService = {
      googleLoginUrl: 'https://auth.example.test/google',
      login: vi.fn(() => of({ token: 'token' })),
      register: vi.fn(() => of({ token: 'token' })),
    };

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  it('renders branded login controls with accessible field icons', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.brand-panel')?.textContent).toContain('CareerKit AI');
    expect(compiled.querySelector('#login-title')?.textContent?.trim()).toBe('Sign in');
    expect(compiled.querySelectorAll('.field-icon svg')).toHaveLength(2);
    expect(compiled.querySelector<HTMLButtonElement>('.password-toggle')?.getAttribute('aria-label')).toBe(
      'Show password',
    );
  });

  it('toggles password visibility with an aria-pressed control', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector<HTMLInputElement>('#password')?.type).toBe('password');

    const toggle = compiled.querySelector<HTMLButtonElement>('.password-toggle');
    toggle?.click();
    fixture.detectChanges();

    const updatedPasswordInput = compiled.querySelector<HTMLInputElement>('#password');
    expect(updatedPasswordInput?.type).toBe('text');
    expect(toggle?.getAttribute('aria-label')).toBe('Hide password');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a spinner and busy state while email sign in is pending', () => {
    const pendingLogin = new Subject<{ token: string }>();
    authService.login.mockReturnValueOnce(pendingLogin.asObservable());

    const component = fixture.componentInstance as unknown as TestableLoginPage;
    component.email = 'jane@example.com';
    component.password = 'password';
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled
      .querySelector<HTMLFormElement>('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    const submitButton = compiled.querySelector<HTMLButtonElement>('.submit-button');
    expect(submitButton?.disabled).toBe(true);
    expect(submitButton?.getAttribute('aria-busy')).toBe('true');
    expect(submitButton?.querySelector('.button-spinner')).toBeTruthy();
  });

  it('shows a friendly accessible message and clears only the password after a failed login', () => {
    authService.login.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            statusText: 'Unauthorized',
            error: { message: 'Unauthorized' },
          }),
      ),
    );

    const component = fixture.componentInstance as unknown as TestableLoginPage;
    component.email = 'jane@example.com';
    component.password = 'wrong-password';
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled
      .querySelector<HTMLFormElement>('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    const alert = compiled.querySelector<HTMLElement>('#login-error');
    const submitButton = compiled.querySelector<HTMLButtonElement>('.submit-button');

    expect(component.email).toBe('jane@example.com');
    expect(component.password).toBe('');
    expect(component.isSubmitting).toBe(false);
    expect(component.errorMessage).toBe('Invalid email or password.');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.getAttribute('aria-live')).toBe('assertive');
    expect(alert?.querySelector('svg')).toBeTruthy();
    expect(alert?.textContent).toContain('Invalid email or password.');
    expect(submitButton?.disabled).toBe(false);
    expect(submitButton?.getAttribute('aria-busy')).toBe('false');
  });

  it('maps common authentication failure status codes to actionable messages', () => {
    const component = fixture.componentInstance as unknown as TestableLoginPage & {
      resolveAuthErrorMessage: (error: unknown) => string;
    };

    expect(
      component.resolveAuthErrorMessage(
        new HttpErrorResponse({
          status: 404,
          error: { detail: 'Not Found' },
        }),
      ),
    ).toBe('No account found with this email.');
    expect(
      component.resolveAuthErrorMessage(
        new HttpErrorResponse({
          status: 403,
          error: { detail: 'Forbidden' },
        }),
      ),
    ).toBe('Your account has been disabled. Contact support if you think this is a mistake.');
    expect(
      component.resolveAuthErrorMessage(
        new HttpErrorResponse({
          status: 429,
          error: { message: 'Too Many Requests' },
        }),
      ),
    ).toBe('Too many login attempts. Please try again later.');
    expect(
      component.resolveAuthErrorMessage(
        new HttpErrorResponse({
          status: 0,
        }),
      ),
    ).toBe('Network error. Please check your connection and try again.');
  });
});
