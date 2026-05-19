import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface DbUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'user';
}

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.scss'
})
export class AdminPage implements OnInit {
  users = signal<DbUser[]>([]);
  editingUser = signal<DbUser | null>(null);
  first_name = '';
  last_name = '';
  role: 'admin' | 'user' = 'user';
  editFirstName = '';
  editLastName = '';
  editRole: 'admin' | 'user' = 'user';

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  private loadUsers(): void {
    this.http.get<DbUser[]>(`${environment.apiUrl}/users`).subscribe((rows) => this.users.set(rows));
  }

  private sanitizeEmailPart(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  emailPreview(): string {
    const first = this.sanitizeEmailPart(this.first_name);
    const last = this.sanitizeEmailPart(this.last_name);
    const localPart = `${first}.${last}`.replace(/\.+/g, '.').replace(/^\.|\.$/g, '') || 'utilisateur';
    return `${localPart}@maconducouer`;
  }

  addUser(): void {
    if (!this.first_name.trim() || !this.last_name.trim()) {
      this.toast.error('Nom et prenom sont obligatoires');
      return;
    }

    const token = this.auth.token();
    if (!token) {
      this.toast.error('Session invalide');
      return;
    }

    this.http
      .post<DbUser>(
        `${environment.apiUrl}/users`,
        {
          first_name: this.first_name.trim(),
          last_name: this.last_name.trim(),
          role: this.role
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.first_name = '';
          this.last_name = '';
          this.role = 'user';
          this.toast.success('Utilisateur ajoute');
          this.loadUsers();
        },
        error: () => this.toast.error('Impossible d\'ajouter l\'utilisateur')
      });
  }

  startEditUser(user: DbUser): void {
    this.editingUser.set(user);
    this.editFirstName = user.first_name;
    this.editLastName = user.last_name;
    this.editRole = user.role;
  }

  cancelEditUser(): void {
    this.editingUser.set(null);
    this.editFirstName = '';
    this.editLastName = '';
    this.editRole = 'user';
  }

  saveUserEdit(): void {
    const user = this.editingUser();
    if (!user) return;

    if (!this.editFirstName.trim() || !this.editLastName.trim()) {
      this.toast.error('Nom et prenom sont obligatoires');
      return;
    }

    this.http
      .put(
        `${environment.apiUrl}/users/${user.id}`,
        {
          first_name: this.editFirstName.trim(),
          last_name: this.editLastName.trim(),
          role: this.editRole
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Utilisateur mis a jour');
          this.cancelEditUser();
          this.loadUsers();
        },
        error: () => this.toast.error('Impossible de sauvegarder cet utilisateur')
      });
  }

}
