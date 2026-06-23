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

  it('shows upload navigation and theme settings from the hamburger menu', () => {
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
    const themeOptions = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.navigation-menu .theme-option'));

    expect(menuToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(uploadLink?.textContent?.trim()).toBe('Upload page');
    expect(uploadLink?.getAttribute('href')).toBe('/upload');
    expect(themeOptions.map((button) => button.textContent?.trim())).toEqual(['Violet', 'Teal', 'Rose']);
  });

  it('applies the default violet theme to the app shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector<HTMLElement>('.brand-link');
    const header = compiled.querySelector<HTMLElement>('.site-header');
    const themeStyles = getComputedStyle(compiled);

    expect(compiled.getAttribute('data-theme')).toBe('violet');
    expect(themeStyles.getPropertyValue('--theme-screen').trim()).toBe('#f7f2ff');
    expect(themeStyles.getPropertyValue('--theme-accent-tint').trim()).toBe('rgba(109, 40, 217, 0.05)');
    expect(brand).toBeTruthy();
    expect(getComputedStyle(header as HTMLElement).backgroundColor).toBe('rgb(255, 255, 255)');
  });

  it('does not show theme controls until the menu is opened', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.theme-option').length).toBe(0);

    compiled.querySelector<HTMLButtonElement>('.menu-toggle')?.click();
    fixture.detectChanges();

    const themeOptions = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.theme-option'));

    expect(themeOptions.map((button) => button.textContent?.trim())).toEqual(['Violet', 'Teal', 'Rose']);
    expect(compiled.getAttribute('data-theme')).toBe('violet');
    expect(themeOptions[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('updates the header and screen theme when a theme is selected', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.menu-toggle')?.click();
    fixture.detectChanges();

    const tealOption = compiled.querySelectorAll<HTMLButtonElement>('.theme-option')[1];

    tealOption.click();
    fixture.detectChanges();

    const themeStyles = getComputedStyle(compiled);

    expect(compiled.getAttribute('data-theme')).toBe('teal');
    expect(tealOption.classList.contains('active')).toBe(true);
    expect(tealOption.getAttribute('aria-pressed')).toBe('true');
    expect(themeStyles.getPropertyValue('--theme-screen').trim()).toBe('#ecfdf5');
    expect(themeStyles.getPropertyValue('--theme-accent-tint').trim()).toBe('rgba(15, 118, 110, 0.05)');
  });
});
