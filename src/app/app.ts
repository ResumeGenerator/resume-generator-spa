import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

type ThemeId = 'violet' | 'teal' | 'rose';

interface AppTheme {
  id: ThemeId;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '[attr.data-theme]': 'selectedThemeId()',
  },
})
export class App {
  protected readonly themes: AppTheme[] = [
    { id: 'violet', label: 'Violet' },
    { id: 'teal', label: 'Teal' },
    { id: 'rose', label: 'Rose' },
  ];
  protected readonly selectedThemeId = signal<ThemeId>('violet');
  protected readonly isMenuOpen = signal(false);

  protected selectTheme(themeId: ThemeId): void {
    this.selectedThemeId.set(themeId);
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update((isOpen) => !isOpen);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
