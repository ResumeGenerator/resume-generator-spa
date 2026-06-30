import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  let isAuthenticated: boolean;

  beforeEach(async () => {
    isAuthenticated = false;

    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => isAuthenticated,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders login-themed actions for logged-out users', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const primaryAction = compiled.querySelector<HTMLAnchorElement>(
      '.hero-actions .primary-action',
    );
    const secondaryAction = compiled.querySelector<HTMLAnchorElement>('.hero-actions .secondary-action');

    expect(primaryAction?.textContent).toContain('Start Creating');
    expect(primaryAction?.getAttribute('href')).toBe('/login');
    expect(secondaryAction?.textContent?.trim()).toBe('Sign In');
    expect(secondaryAction?.getAttribute('href')).toBe('/login');
  });

  it('hides Sign In and routes primary actions to the workspace when authenticated', () => {
    isAuthenticated = true;

    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const primaryAction = compiled.querySelector<HTMLAnchorElement>(
      '.hero-actions .primary-action',
    );
    const ctaAction = compiled.querySelector<HTMLAnchorElement>('.cta-section .light-action');

    expect(compiled.querySelector('.hero-actions .secondary-action')).toBeNull();
    expect(primaryAction?.textContent).toContain('Open workspace');
    expect(primaryAction?.getAttribute('href')).toBe('/upload');
    expect(ctaAction?.textContent).toContain('Open workspace');
    expect(ctaAction?.getAttribute('href')).toBe('/upload');
  });
});
