import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: false,
})
export class App {
  constructor(private authService: AuthService, private router: Router) {}

  get showNavbar(): boolean {
    const url = this.router.url || '';
    return !(url.startsWith('/login') || url.startsWith('/register'));
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get profileLabel(): string {
    return this.authService.getUserDisplayName() || 'Profil';
  }

  get profileEmail(): string {
    return this.authService.getUserEmail() || '';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
