import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  protected mode: 'login' | 'register' = 'login';
  protected email = '';
  protected password = '';
  protected displayName = '';
  protected rememberMe = false;
  protected submitted = false;
  protected isSubmitting = false;
  protected errorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    if (this.route.snapshot.queryParamMap.get('authError') === 'missing-token') {
      this.errorMessage = 'Google sign in did not return a valid token. Please try again.';
    }
  }

  protected get isRegisterMode(): boolean {
    return this.mode === 'register';
  }

  protected submitAuth(): void {
    this.submitted = true;
    this.errorMessage = '';

    const email = this.email.trim();
    const password = this.password;
    const displayName = this.displayName.trim();
    const validationError = this.validateAuthForm(email, password, displayName);

    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.isSubmitting = true;
    const request = this.isRegisterMode
      ? this.authService.register(email, password, displayName)
      : this.authService.login(email, password);

    request.pipe(finalize(() => (this.isSubmitting = false))).subscribe({
      next: () => {
        const returnUrl = this.resolveReturnUrl();
        void this.router.navigateByUrl(returnUrl);
      },
      error: (error: unknown) => {
        this.errorMessage = this.resolveAuthErrorMessage(error);
      },
    });
  }

  protected showLogin(): void {
    this.mode = 'login';
    this.submitted = false;
    this.errorMessage = '';
  }

  protected showRegister(): void {
    this.mode = 'register';
    this.submitted = false;
    this.errorMessage = '';
  }

  protected startGoogleLogin(): void {
    window.location.assign(this.authService.googleLoginUrl);
  }

  private validateAuthForm(email: string, password: string, displayName: string): string {
    if (!email) {
      return 'Enter your email address.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Enter a valid email address.';
    }

    if (!password) {
      return 'Enter your password.';
    }

    if (this.isRegisterMode && password.length < 8) {
      return 'Use a password with at least 8 characters.';
    }

    if (this.isRegisterMode && !displayName) {
      return 'Enter your display name.';
    }

    return '';
  }

  private resolveAuthErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = this.extractApiMessage(error.error);

      if (apiMessage) {
        return apiMessage;
      }

      if (error.status === 401) {
        return 'The email or password is not correct.';
      }

      if (error.status === 409) {
        return 'An account with this email already exists.';
      }

      if (error.status === 0) {
        return 'Could not reach the authentication service. Check your connection and try again.';
      }
    }

    return this.isRegisterMode
      ? 'Could not create your account. Please try again.'
      : 'Could not sign you in. Please try again.';
  }

  private resolveReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return returnUrl?.startsWith('/') ? returnUrl : '/upload';
  }

  private extractApiMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const record = payload as Record<string, unknown>;
    const message = record['detail'] ?? record['message'] ?? record['error'];

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && message.length > 0) {
      return message.map((item) => String(item)).join(' ');
    }

    return '';
  }
}
