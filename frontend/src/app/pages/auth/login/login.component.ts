import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  form: FormGroup;
  loginError = false;

  constructor(private fb: FormBuilder, private router: Router, public authService: AuthService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  get email() { return this.form.get('email'); }
  get password() { return this.form.get('password'); }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loginError = false;
    const email = this.form.get('email')?.value;
    const password = this.form.get('password')?.value;

    this.authService.login(email, password).subscribe((isAuthenticated) => {
      if (isAuthenticated) {
        this.router.navigate(['/mes-cours']);
        return;
      }

      this.loginError = true;
    });
  }
}
