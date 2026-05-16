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

  nom = '';
  pays = '';
  site_web = '';
  icon = '';

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
}
