import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'user';
  avatar_file_id: string | null;
  avatar_url: string | null;
}

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss'
})
export class AccountPage implements OnInit {
  profile = signal<Profile | null>(null);

  profileFirstName = '';
  profileLastName = '';
  profilePhone = '';
  profileEmail = '';

  loading = signal(false);

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  loadProfile(): void {
    this.http
      .get<Profile>(`${environment.apiUrl}/users/me`, { headers: this.authHeaders() })
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.profileFirstName = profile.first_name;
          this.profileLastName = profile.last_name;
          this.profilePhone = profile.phone ?? '';
          this.profileEmail = profile.email;
        },
        error: () => this.toast.error('Impossible de charger le profil')
      });
  }

  saveProfile(): void {
    this.http
      .put(
        `${environment.apiUrl}/users/me`,
        {
          first_name: this.profileFirstName,
          last_name: this.profileLastName,
          phone: this.profilePhone
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.http
            .put(`${environment.apiUrl}/auth/me/email`, { email: this.profileEmail }, { headers: this.authHeaders() })
            .subscribe({
              next: () => {
                this.toast.success('Profil mis a jour');
                this.loadProfile();
              },
              error: () => this.toast.error('Impossible de mettre a jour l\'email')
            });
        },
        error: () => this.toast.error('Impossible de mettre a jour le profil')
      });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.loading.set(true);

    const formData = new FormData();
    formData.append('file', file);

    this.http
      .post<{ id: string }>(`${environment.apiUrl}/files`, formData, { headers: this.authHeaders() })
      .subscribe({
        next: (uploaded) => {
          this.http
            .put(`${environment.apiUrl}/users/me/avatar`, { file_id: uploaded.id }, { headers: this.authHeaders() })
            .subscribe({
              next: () => {
                this.loading.set(false);
                this.toast.success('Avatar mis a jour');
                this.loadProfile();
              },
              error: () => {
                this.loading.set(false);
                this.toast.error('Impossible de lier l\'avatar au profil');
              }
            });
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Upload avatar echoue');
        }
      });
  }

  avatarImageUrl(fileId: string | null): string | null {
    if (!fileId) return null;
    return `${environment.apiUrl}/files/${fileId}/data`;
  }
}
