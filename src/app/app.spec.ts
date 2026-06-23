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

  it('applies the default violet theme to the app shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector<HTMLElement>('.brand-link');
    const themeStyles = getComputedStyle(compiled);

    expect(compiled.getAttribute('data-theme')).toBe('violet');
    expect(themeStyles.getPropertyValue('--theme-header').trim()).toBe('#8b5cf6');
    expect(themeStyles.getPropertyValue('--theme-screen').trim()).toBe('#f7f2ff');
    expect(brand).toBeTruthy();
    expect(getComputedStyle(brand as HTMLElement).color).toBe('rgb(255, 255, 255)');
  });

  it('shows three selectable themes', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const themeOptions = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.theme-option'));

    expect(themeOptions.map((button) => button.textContent?.trim())).toEqual(['Violet', 'Teal', 'Rose']);
    expect(compiled.getAttribute('data-theme')).toBe('violet');
    expect(themeOptions[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('updates the header and screen theme when a theme is selected', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tealOption = compiled.querySelectorAll<HTMLButtonElement>('.theme-option')[1];

    tealOption.click();
    fixture.detectChanges();

    const themeStyles = getComputedStyle(compiled);

    expect(compiled.getAttribute('data-theme')).toBe('teal');
    expect(tealOption.classList.contains('active')).toBe(true);
    expect(tealOption.getAttribute('aria-pressed')).toBe('true');
    expect(themeStyles.getPropertyValue('--theme-header').trim()).toBe('#0d9488');
    expect(themeStyles.getPropertyValue('--theme-screen').trim()).toBe('#ecfdf5');
  });
});
