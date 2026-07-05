import { Component, computed, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly isMenuOpen = signal(false);
  protected readonly isProfileOpen = signal(false);
  protected readonly profileName = computed(() => {
    const user = this.authService.currentUser();
    const displayName = this.asDisplayString(user?.displayName);
    const email = this.asDisplayString(user?.email);

    if (displayName && displayName.toLowerCase() !== email.toLowerCase()) {
      return displayName;
    }

    return this.nameFromEmail(email) || 'User';
  });
  protected readonly profileEmail = computed(() => this.asDisplayString(this.authService.currentUser()?.email));
  protected readonly profileInitials = computed(() => {
    const name = this.profileName();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

    return initials || 'U';
  });

  constructor(
    protected readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  protected toggleMenu(): void {
    this.isMenuOpen.update((isOpen) => !isOpen);
    this.closeProfileMenu();
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected toggleProfileMenu(): void {
    this.isProfileOpen.update((isOpen) => !isOpen);
    this.closeMenu();
  }

  protected closeProfileMenu(): void {
    this.isProfileOpen.set(false);
  }

  protected logout(): void {
    this.authService.logout();
    this.closeMenu();
    this.closeProfileMenu();
    void this.router.navigate(['/login']);
  }

  private asDisplayString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private nameFromEmail(email: string): string {
    const localPart = email.split('@')[0]?.trim();

    if (!localPart) {
      return '';
    }

    return localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
