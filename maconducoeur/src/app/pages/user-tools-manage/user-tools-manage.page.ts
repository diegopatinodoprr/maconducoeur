import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, DestroyRef, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { RealtimeService } from '../../services/realtime.service';
import { ToastService } from '../../services/toast.service';

type ToolCategory = 'jardin' | 'placo' | 'electricite' | 'bois' | 'eau';
type ToolState = 'neuf' | 'bon' | 'use';

interface ToolItem {
  id: string;
  nom: string;
  categorie: ToolCategory;
  description: string | null;
  localisation_address_id: string | null;
  localisation_address: {
    id: string;
    user_id: string;
    label: string;
    rue: string;
    ville: string;
    code_postal: string;
  } | null;
  marque_id: string | null;
  marque: string | null;
  image_url: string | null;
  etat: ToolState;
  disponible: boolean;
}

interface Manufacturer {
  id: string;
  nom: string;
}

interface AddressItem {
  id: string;
  user_id: string;
  label: string;
  rue: string;
  ville: string;
  code_postal: string;
}

@Component({
  selector: 'app-user-tools-manage-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user-tools-manage.page.html',
  styleUrl: './user-tools-manage.page.scss'
})
export class UserToolsManagePage implements OnInit {
  tools = signal<ToolItem[]>([]);
  manufacturers = signal<Manufacturer[]>([]);
  addresses = signal<AddressItem[]>([]);

  readonly categories: ToolCategory[] = ['jardin', 'placo', 'electricite', 'bois', 'eau'];
  readonly states: ToolState[] = ['neuf', 'bon', 'use'];

  nom = '';
  categorie: ToolCategory = 'bois';
  etat: ToolState = 'bon';
  description = '';
  localisation_address_id = '';
  marque_id = '';
  disponible = true;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly realtime: RealtimeService,
    private readonly destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.realtime.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.type === 'tool.created' || event.type === 'tool.updated' || event.type === 'borrowing.status_changed') {
          this.loadData();
        }
      });
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  loadData(): void {
    this.http.get<ToolItem[]>(`${environment.apiUrl}/utils/me`, { headers: this.authHeaders() }).subscribe({
      next: (rows) => this.tools.set(rows),
      error: () => this.toast.error('Impossible de charger vos outils')
    });

    this.http.get<Manufacturer[]>(`${environment.apiUrl}/utils/manufacturers`).subscribe({
      next: (rows) => this.manufacturers.set(rows),
      error: () => this.toast.error('Impossible de charger les marques')
    });

    this.http.get<AddressItem[]>(`${environment.apiUrl}/users/addresses`, { headers: this.authHeaders() }).subscribe({
      next: (rows) => this.addresses.set(rows),
      error: () => this.toast.error('Impossible de charger les adresses')
    });
  }

  addTool(): void {
    if (!this.nom.trim() || !this.marque_id || !this.localisation_address_id) {
      this.toast.error('Nom, marque et adresse de localisation sont obligatoires');
      return;
    }

    this.http
      .post(
        `${environment.apiUrl}/utils`,
        {
          nom: this.nom.trim(),
          categorie: this.categorie,
          etat: this.etat,
          description: this.description.trim(),
          localisation_address_id: this.localisation_address_id,
          marque_id: this.marque_id,
          disponible: this.disponible
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.nom = '';
          this.description = '';
          this.localisation_address_id = '';
          this.disponible = true;
          this.toast.success('Outil ajoute');
          this.loadData();
        },
        error: () => this.toast.error('Impossible d\'ajouter cet outil')
      });
  }

  toggleAvailability(tool: ToolItem): void {
    this.http
      .put(
        `${environment.apiUrl}/utils/${tool.id}`,
        {
          disponible: !tool.disponible
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Disponibilite mise a jour');
          this.loadData();
        },
        error: () => this.toast.error('Impossible de mettre a jour la disponibilite')
      });
  }

  updateLocalisation(tool: ToolItem, addressId: string): void {
    if (!addressId) {
      this.toast.error('Adresse de localisation obligatoire');
      return;
    }

    this.http
      .put(
        `${environment.apiUrl}/utils/${tool.id}`,
        {
          localisation_address_id: addressId
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Localisation mise a jour');
          this.loadData();
        },
        error: () => this.toast.error('Impossible de mettre a jour la localisation')
      });
  }

  onToolPhotoSelected(toolId: string, event: Event): void {
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
              `${environment.apiUrl}/utils/${toolId}/image`,
              { file_id: uploaded.id },
              { headers: this.authHeaders() }
            )
            .subscribe({
              next: () => {
                this.toast.success('Photo outil mise a jour');
                this.loadData();
              },
              error: () => this.toast.error('Impossible d\'associer la photo a l\'outil')
            });
        },
        error: () => this.toast.error('Upload photo outil echoue')
      });
  }

  fullImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = environment.apiUrl.replace(/\/api$/, '');
    return `${apiBase}${url}`;
  }
}
