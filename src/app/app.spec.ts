import { signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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
      refreshCurrentUser: vi.fn(),
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

  it('does not refresh the current user profile during shell rendering', () => {
    isAuthenticated = true;

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(authService.refreshCurrentUser).not.toHaveBeenCalled();
  });

  it('shows public header actions without the hamburger menu when signed out', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector<HTMLAnchorElement>('.brand-link');
    const navLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.header-nav a'));
    const leadingItems = Array.from(compiled.querySelectorAll('.header-leading > *'));

    expect(brand?.textContent?.trim()).toBe('CareerKit AI');
    expect(brand?.getAttribute('href')).toBe('/');
    expect(leadingItems).toHaveLength(1);
    expect(leadingItems[0].classList.contains('brand-link')).toBe(true);
    expect(compiled.querySelector('.brand-menu-button')).toBeNull();
    expect(compiled.querySelector('.navigation-menu')).toBeNull();
    expect(navLinks.map((link) => link.textContent?.trim())).toEqual(['Start Creating', 'Sign In']);
    expect(navLinks.map((link) => link.getAttribute('href'))).toEqual(['/login', '/login']);
  });

  it('opens the authenticated navigation from the left brand menu button', () => {
    isAuthenticated = true;
    currentUser.set({
      email: 'jane@example.com',
      displayName: 'Jane Appleseed',
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const menuToggle = compiled.querySelector<HTMLButtonElement>('.brand-menu-button');
    const profileButton = compiled.querySelector<HTMLButtonElement>('.profile-button');

    expect(menuToggle).toBeTruthy();
    expect(menuToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.navigation-menu')).toBeNull();
    expect(profileButton?.textContent?.trim()).toBe('JA');
    expect(profileButton?.getAttribute('aria-label')).toBe('Open account menu');
    expect(profileButton?.textContent).not.toContain('Jane Appleseed');

    menuToggle?.click();
    fixture.detectChanges();

    const menuLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.navigation-menu a'));

    expect(menuToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(menuLinks.map((link) => link.textContent?.trim())).toEqual([
      'Home',
      'Document Workspace',
      'Resume Builder',
    ]);
    expect(menuLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/upload',
      '/resume-builder',
    ]);
    expect(compiled.querySelector('.navigation-menu button')?.textContent?.trim()).toBe('Sign out');
    expect(compiled.querySelector('.navigation-menu')?.textContent).not.toContain('Jane Appleseed');

    profileButton?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.navigation-menu')).toBeNull();
    expect(profileButton?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelector('.profile-panel')?.textContent).toContain('Jane Appleseed');
    expect(compiled.querySelector('.profile-logout')?.textContent?.trim()).toBe('Sign out');
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
    const menuToggle = compiled.querySelector<HTMLButtonElement>('.brand-menu-button');
    const profileButton = compiled.querySelector<HTMLButtonElement>('.profile-button');

    expect(navLinks).toHaveLength(0);
    expect(compiled.querySelector('.primary-nav-link')).toBeNull();
    expect(compiled.querySelector('.login-nav-link')).toBeNull();
    expect(menuToggle).toBeTruthy();
    expect(profileButton?.textContent?.trim()).toBe('JA');
    expect(profileButton?.textContent).not.toContain('Jane Appleseed');
  });
});
