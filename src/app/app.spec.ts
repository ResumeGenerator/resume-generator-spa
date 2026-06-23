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

  it('shows a full page upload link from the hamburger menu', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const menuToggle = compiled.querySelector<HTMLButtonElement>('.menu-toggle');

    expect(menuToggle).toBeTruthy();
    expect(menuToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.navigation-menu')).toBeNull();

    menuToggle?.click();
    fixture.detectChanges();

    const uploadLink = compiled.querySelector<HTMLAnchorElement>('.navigation-menu a');

    expect(menuToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(uploadLink?.textContent?.trim()).toBe('Upload page');
    expect(uploadLink?.getAttribute('href')).toBe('/upload');
  });

  it('applies the purple theme to the header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const header = compiled.querySelector<HTMLElement>('.site-header');
    const brand = compiled.querySelector<HTMLElement>('.brand-link');

    expect(header).toBeTruthy();
    expect(brand).toBeTruthy();
    expect(getComputedStyle(header as HTMLElement).backgroundColor).toBe('rgb(139, 92, 246)');
    expect(getComputedStyle(brand as HTMLElement).color).toBe('rgb(255, 255, 255)');
  });
});
