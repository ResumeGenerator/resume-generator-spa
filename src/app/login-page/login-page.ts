import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  protected email = '';
  protected password = '';
  protected rememberMe = false;
  protected submitted = false;

  protected submitLogin(): void {
    this.submitted = true;
  }
}
