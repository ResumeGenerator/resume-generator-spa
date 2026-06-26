import { Component, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService, CurrentUser } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly isMenuOpen = signal(false);
  protected readonly isProfileOpen = signal(false);
  protected readonly currentUser = signal<CurrentUser | null>(null);

  constructor(
    protected readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();

    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
      if (this.authService.isAuthenticated() && !this.currentUser()) {
        this.loadCurrentUser();
      }
    });
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update((isOpen) => !isOpen);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected toggleProfileMenu(): void {
    this.isProfileOpen.update((isOpen) => !isOpen);
  }

  protected closeProfileMenu(): void {
    this.isProfileOpen.set(false);
  }

  protected logout(): void {
    this.authService.logout();
    this.currentUser.set(null);
    this.closeMenu();
    this.closeProfileMenu();
    void this.router.navigate(['/login']);
  }

  protected profileName(): string {
    const user = this.currentUser();
    return this.asDisplayString(user?.displayName) || this.asDisplayString(user?.name) || this.asDisplayString(user?.email) || 'Account';
  }

  protected profileEmail(): string {
    return this.asDisplayString(this.currentUser()?.email);
  }

  protected profileInitials(): string {
    const name = this.profileName();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

    return initials || 'A';
  }

  private loadCurrentUser(): void {
    if (!this.authService.isAuthenticated()) {
      this.currentUser.set(null);
      return;
    }

    this.authService.getCurrentUser().subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.currentUser.set(null),
    });
  }

  private asDisplayString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
