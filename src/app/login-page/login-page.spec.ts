import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { LoginPage } from './login-page';

type TestableLoginPage = {
  email: string;
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
});
