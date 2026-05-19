import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface Manufacturer {
  id: string;
  nom: string;
  pays: string | null;
  site_web: string | null;
  icon: string | null;
}

@Component({
  selector: 'app-admin-manufacturers-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-manufacturers.page.html',
  styleUrl: './admin-manufacturers.page.scss'
})
export class AdminManufacturersPage implements OnInit {
  manufacturers = signal<Manufacturer[]>([]);
  editingManufacturer = signal<Manufacturer | null>(null);

  nom = '';
  pays = '';
  site_web = '';
  icon = '';
  editNom = '';
  editPays = '';
  editSiteWeb = '';
  editIcon = '';

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadManufacturers();
  }

  loadManufacturers(): void {
    this.http
      .get<Manufacturer[]>(`${environment.apiUrl}/utils/manufacturers`)
      .subscribe((rows) => this.manufacturers.set(rows));
  }

  addManufacturer(): void {
    if (!this.nom.trim()) {
      this.toast.error('Le nom est obligatoire');
      return;
    }

    const token = this.auth.token();
    if (!token) {
      this.toast.error('Session invalide');
      return;
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http
      .post(
        `${environment.apiUrl}/utils/manufacturers`,
        {
          nom: this.nom,
          pays: this.pays,
          site_web: this.site_web,
          icon: this.icon
        },
        { headers }
      )
      .subscribe({
        next: () => {
          this.nom = '';
          this.pays = '';
          this.site_web = '';
          this.icon = '';
          this.toast.success('Marque ajoutee');
          this.loadManufacturers();
        },
        error: () => this.toast.error('Impossible d\'ajouter la marque')
      });
  }

  deleteManufacturer(id: string): void {
    const token = this.auth.token();
    if (!token) {
      this.toast.error('Session invalide');
      return;
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http
      .delete(`${environment.apiUrl}/utils/manufacturers/${id}`, { headers })
      .subscribe({
        next: () => {
          this.toast.success('Marque supprimee');
          this.loadManufacturers();
        },
        error: () => this.toast.error('Suppression impossible')
      });
  }

  startEditManufacturer(manufacturer: Manufacturer): void {
    this.editingManufacturer.set(manufacturer);
    this.editNom = manufacturer.nom;
    this.editPays = manufacturer.pays ?? '';
    this.editSiteWeb = manufacturer.site_web ?? '';
    this.editIcon = manufacturer.icon ?? '';
  }

  cancelEditManufacturer(): void {
    this.editingManufacturer.set(null);
    this.editNom = '';
    this.editPays = '';
    this.editSiteWeb = '';
    this.editIcon = '';
  }

  saveManufacturerEdit(): void {
    const manufacturer = this.editingManufacturer();
    if (!manufacturer) return;
    if (!this.editNom.trim()) {
      this.toast.error('Le nom est obligatoire');
      return;
    }

    this.http
      .put(
        `${environment.apiUrl}/utils/manufacturers/${manufacturer.id}`,
        {
          nom: this.editNom.trim(),
          pays: this.editPays.trim(),
          site_web: this.editSiteWeb.trim(),
          icon: this.editIcon.trim()
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Marque mise a jour');
          this.cancelEditManufacturer();
          this.loadManufacturers();
        },
        error: () => this.toast.error('Impossible de sauvegarder la marque')
      });
  }

  deleteEditingManufacturer(): void {
    const manufacturer = this.editingManufacturer();
    if (!manufacturer) return;

    this.http
      .delete(`${environment.apiUrl}/utils/manufacturers/${manufacturer.id}`, { headers: this.authHeaders() })
      .subscribe({
        next: () => {
          this.toast.success('Marque supprimee');
          this.cancelEditManufacturer();
          this.loadManufacturers();
        },
        error: () => this.toast.error('Suppression impossible')
      });
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.token();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
