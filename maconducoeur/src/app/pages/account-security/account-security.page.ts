import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-account-security-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './account-security.page.html',
  styleUrl: './account-security.page.scss'
})
export class AccountSecurityPage {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  updatePassword(): void {
    if (this.newPassword !== this.confirmPassword) {
      this.toast.error('La confirmation du mot de passe ne correspond pas');
      return;
    }

    this.http
      .put(
        `${environment.apiUrl}/auth/me/password`,
        {
          current_password: this.currentPassword,
          new_password: this.newPassword
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.toast.success('Mot de passe mis a jour');
        },
        error: () => this.toast.error('Impossible de mettre a jour le mot de passe')
      });
  }
}
