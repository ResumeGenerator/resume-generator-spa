import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.html',
  styleUrl: './auth-callback.css',
})
export class AuthCallback implements OnInit {
  protected message = 'Finishing sign in...';

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.message = 'The sign-in callback did not include a token. Please try signing in again.';
      void this.router.navigate(['/login'], {
        queryParams: {
          authError: 'missing-token',
        },
      });
      return;
    }

    this.authService.storeToken(token);
    void this.router.navigate(['/upload']);
  }
}
