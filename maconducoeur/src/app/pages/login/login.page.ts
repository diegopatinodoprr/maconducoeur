import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPage {
  email = '';
  password = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toast: ToastService
  ) {}

  onSubmit(): void {
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        const role = this.auth.role();
        this.toast.success('Connexion reussie');
        this.router.navigateByUrl(role === 'admin' ? '/admin' : '/utilisateur/utils/mes-outils');
      },
      error: () => this.toast.error('Identifiants invalides')
    });
  }
}
