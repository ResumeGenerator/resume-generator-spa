import { signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { App } from './app';
import { AuthService } from './services/auth.service';
import type { CurrentUser } from './services/auth.service';

describe('App', () => {
  let isAuthenticated: boolean;
  let currentUser: WritableSignal<CurrentUser | null>;
  let authService: {
    currentUser: WritableSignal<CurrentUser | null>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    refreshCurrentUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    isAuthenticated = false;
    currentUser = signal<CurrentUser | null>(null);
    authService = {
      currentUser,
      isAuthenticated: vi.fn(() => isAuthenticated),
      logout: vi.fn(),
      refreshCurrentUser: vi.fn(() => of({})),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('shows brand navigation for the landing, upload, and login pages', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector<HTMLAnchorElement>('.brand-link');
    const navLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.header-nav a'));
    const leadingItems = Array.from(compiled.querySelectorAll('.header-leading > *'));

    expect(brand?.textContent?.trim()).toBe('CareerKit AI');
    expect(brand?.getAttribute('href')).toBe('/');
    expect(leadingItems[0].classList.contains('menu-toggle')).toBe(true);
    expect(leadingItems[1].classList.contains('brand-link')).toBe(true);
    expect(navLinks.map((link) => link.textContent?.trim())).toEqual(['Start Creating', 'Sign In']);
    expect(navLinks.map((link) => link.getAttribute('href'))).toEqual(['/login', '/login']);
  });

  it('opens the left-side hamburger menu', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const menuToggle = compiled.querySelector<HTMLButtonElement>('.menu-toggle');

    expect(menuToggle).toBeTruthy();
    expect(menuToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.navigation-menu')).toBeNull();

    menuToggle?.click();
    fixture.detectChanges();

    const menu = compiled.querySelector<HTMLElement>('.navigation-menu');
    const menuLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.navigation-menu a'));

    expect(menuToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(getComputedStyle(menu as HTMLElement).left).toBe('24px');
    expect(menuLinks.map((link) => link.textContent?.trim())).toEqual([
      'Home',
      'Document Workspace',
      'Resume Builder',
      'Sign In',
    ]);
    expect(menuLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/upload',
      '/resume-builder',
      '/login',
    ]);
  });

  it('renders the login-themed header and compact action buttons', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const header = compiled.querySelector<HTMLElement>('.site-header');
    const primaryLink = compiled.querySelector<HTMLElement>('.primary-nav-link');
    const loginLink = compiled.querySelector<HTMLElement>('.login-nav-link');

    expect(header).toBeTruthy();
    expect(getComputedStyle(header as HTMLElement).backgroundColor).toBe(
      'rgba(255, 255, 255, 0.94)',
    );
    expect(getComputedStyle(primaryLink as HTMLElement).borderRadius).toBe('8px');
    expect(getComputedStyle(loginLink as HTMLElement).borderRadius).toBe('8px');
  });

  it('shows only the profile account menu in the desktop header when authenticated', () => {
    isAuthenticated = true;
    currentUser.set({
      email: 'jane@example.com',
      displayName: 'Jane Appleseed',
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const navLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.header-nav a'));
    const profileButton = compiled.querySelector<HTMLButtonElement>('.profile-button');

    expect(navLinks).toHaveLength(0);
    expect(compiled.querySelector('.primary-nav-link')).toBeNull();
    expect(compiled.querySelector('.login-nav-link')).toBeNull();
    expect(profileButton?.textContent).toContain('Jane Appleseed');
  });
});
