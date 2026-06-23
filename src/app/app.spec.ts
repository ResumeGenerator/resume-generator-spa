import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideRouter([])],
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

    expect(brand?.textContent?.trim()).toBe('ResumeAI');
    expect(brand?.getAttribute('href')).toBe('/');
    expect(navLinks.map((link) => link.textContent?.trim())).toEqual(['Create Resume', 'Login']);
    expect(navLinks.map((link) => link.getAttribute('href'))).toEqual(['/upload', '/login']);
  });

  it('renders the gradient header and compact action buttons', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const header = compiled.querySelector<HTMLElement>('.site-header');
    const primaryLink = compiled.querySelector<HTMLElement>('.primary-nav-link');
    const loginLink = compiled.querySelector<HTMLElement>('.login-nav-link');

    expect(header).toBeTruthy();
    expect(getComputedStyle(header as HTMLElement).backgroundImage).toContain('linear-gradient');
    expect(getComputedStyle(primaryLink as HTMLElement).borderRadius).toBe('8px');
    expect(getComputedStyle(loginLink as HTMLElement).borderRadius).toBe('8px');
  });
});
