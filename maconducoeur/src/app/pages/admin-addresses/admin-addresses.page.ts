import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface AddressItem {
  id: string;
  label: string;
  rue: string;
  ville: string;
  code_postal: string;
  owner_user: { id: string; first_name: string; last_name: string; email: string } | null;
}

interface UserItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

@Component({
  selector: 'app-admin-addresses-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-addresses.page.html',
  styleUrl: './admin-addresses.page.scss'
})
export class AdminAddressesPage implements OnInit {
  addresses = signal<AddressItem[]>([]);
  users = signal<UserItem[]>([]);
  editingAddress = signal<AddressItem | null>(null);

  addLabel = '';
  addUserId = '';
  editLabel = '';
  editRue = '';
  editVille = '';
  editCodePostal = '';

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAddresses();
    this.loadUsers();
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  loadAddresses(): void {
    this.http.get<AddressItem[]>(`${environment.apiUrl}/users/addresses`, { headers: this.authHeaders() }).subscribe({
      next: (rows) => this.addresses.set(rows),
      error: () => this.toast.error('Impossible de charger les adresses')
    });
  }

  loadUsers(): void {
    this.http.get<UserItem[]>(`${environment.apiUrl}/users`).subscribe({
      next: (rows) => this.users.set(rows),
      error: () => this.toast.error('Impossible de charger les utilisateurs')
    });
  }

  addAddress(): void {
    if (!this.addLabel.trim() || !this.addUserId) {
      this.toast.error('Nom et utilisateur sont obligatoires');
      return;
    }

    this.http
      .post(
        `${environment.apiUrl}/users/addresses`,
        { label: this.addLabel.trim(), user_id: this.addUserId },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Adresse ajoutee');
          this.addLabel = '';
          this.addUserId = '';
          this.loadAddresses();
        },
        error: () => this.toast.error('Impossible d\'ajouter cette adresse')
      });
  }

  startEdit(address: AddressItem): void {
    this.editingAddress.set(address);
    this.editLabel = address.label;
    this.editRue = address.rue;
    this.editVille = address.ville;
    this.editCodePostal = address.code_postal;
  }

  cancelEdit(): void {
    this.editingAddress.set(null);
    this.editLabel = '';
    this.editRue = '';
    this.editVille = '';
    this.editCodePostal = '';
  }

  saveEdit(): void {
    const address = this.editingAddress();
    if (!address) return;

    if (!this.editLabel.trim() || !this.editRue.trim() || !this.editVille.trim() || !this.editCodePostal.trim()) {
      this.toast.error('Tous les champs adresse sont obligatoires');
      return;
    }

    this.http
      .put(
        `${environment.apiUrl}/users/addresses/${address.id}`,
        {
          label: this.editLabel.trim(),
          rue: this.editRue.trim(),
          ville: this.editVille.trim(),
          code_postal: this.editCodePostal.trim()
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Adresse mise a jour');
          this.cancelEdit();
          this.loadAddresses();
        },
        error: () => this.toast.error('Impossible de sauvegarder cette adresse')
      });
  }

  deleteAddress(): void {
    const address = this.editingAddress();
    if (!address) return;

    this.http
      .delete(`${environment.apiUrl}/users/addresses/${address.id}`, { headers: this.authHeaders() })
      .subscribe({
        next: () => {
          this.toast.success('Adresse supprimee');
          this.cancelEdit();
          this.loadAddresses();
        },
        error: () => this.toast.error('Impossible de supprimer cette adresse')
      });
  }

  ownerDisplay(address: AddressItem): string {
    if (!address.owner_user) return '-';
    return `${address.owner_user.first_name} ${address.owner_user.last_name}`;
  }
}
