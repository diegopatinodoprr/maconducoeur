import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface AddressItem {
  id: string;
  label: string;
  rue: string;
  ville: string;
  code_postal: string;
  image_url: string | null;
}

@Component({
  selector: 'app-account-addresses-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './account-addresses.page.html',
  styleUrl: './account-addresses.page.scss'
})
export class AccountAddressesPage implements OnInit {
  @ViewChild('addressForm') addressForm?: NgForm;
  addresses = signal<AddressItem[]>([]);

  addressRue = '';
  addressVille = '';
  addressCodePostal = '';
  addressLabel = '';

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAddresses();
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  loadAddresses(): void {
    this.http
      .get<AddressItem[]>(`${environment.apiUrl}/users/me/addresses`, { headers: this.authHeaders() })
      .subscribe({
        next: (rows) => this.addresses.set(rows),
        error: () => this.toast.error('Impossible de charger les adresses')
      });
  }

  addAddress(): void {
    this.http
      .post(
        `${environment.apiUrl}/users/me/addresses`,
        {
          label: this.addressLabel,
          rue: this.addressRue,
          ville: this.addressVille,
          code_postal: this.addressCodePostal
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Adresse ajoutee');
          this.addressForm?.resetForm({
            label: '',
            rue: '',
            ville: '',
            code_postal: ''
          });
          this.loadAddresses();
        },
        error: () => this.toast.error('Impossible d\'ajouter l\'adresse')
      });
  }

  deleteAddress(id: string): void {
    this.http
      .delete(`${environment.apiUrl}/users/me/addresses/${id}`, { headers: this.authHeaders() })
      .subscribe({
        next: () => {
          this.toast.success('Adresse supprimee');
          this.loadAddresses();
        },
        error: () => this.toast.error('Suppression adresse impossible')
      });
  }

  onAddressPhotoSelected(addressId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    this.http
      .post<{ id: string }>(`${environment.apiUrl}/files`, formData, { headers: this.authHeaders() })
      .subscribe({
        next: (uploaded) => {
          this.http
            .put(
              `${environment.apiUrl}/users/me/addresses/${addressId}/photo`,
              { image_file_id: uploaded.id },
              { headers: this.authHeaders() }
            )
            .subscribe({
              next: () => {
                this.toast.success('Photo adresse mise a jour');
                this.loadAddresses();
              },
              error: () => this.toast.error('Impossible d\'associer la photo a l\'adresse')
            });
        },
        error: () => this.toast.error('Upload photo adresse echoue')
      });
  }

  fullImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = environment.apiUrl.replace(/\/api$/, '');
    return `${apiBase}${url}`;
  }
}
