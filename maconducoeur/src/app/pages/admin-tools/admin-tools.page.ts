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

interface Manufacturer {
  id: string;
  nom: string;
}

interface UserItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface AddressItem {
  id: string;
  label: string;
  rue: string;
  ville: string;
  code_postal: string;
}

interface ToolItem {
  id: string;
  nom: string;
  categorie: ToolCategory;
  description: string | null;
  localisation_address_id: string | null;
  marque_id: string | null;
  marque: string | null;
  owner_user: UserItem | null;
  borrowed_by_user: UserItem | null;
  etat: ToolState;
  disponible: boolean;
}

@Component({
  selector: 'app-admin-tools-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-tools.page.html',
  styleUrl: './admin-tools.page.scss'
})
export class AdminToolsPage implements OnInit {
  tools = signal<ToolItem[]>([]);
  manufacturers = signal<Manufacturer[]>([]);
  users = signal<UserItem[]>([]);
  addresses = signal<AddressItem[]>([]);

  nom = '';
  categorie: ToolCategory = 'bois';
  etat: ToolState = 'bon';
  description = '';
  marque_id = '';
  localisation_address_id = '';
  owner_user_id = '';
  borrowed_by_user_id = '';
  disponible = true;

  readonly categories: ToolCategory[] = ['jardin', 'placo', 'electricite', 'bois', 'eau'];
  readonly states: ToolState[] = ['neuf', 'bon', 'use'];

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
        if (
          event.type === 'tool.created' ||
          event.type === 'tool.updated' ||
          event.type === 'borrowing.requested' ||
          event.type === 'borrowing.status_changed'
        ) {
          this.loadData();
        }
      });
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  loadData(): void {
    this.http.get<ToolItem[]>(`${environment.apiUrl}/utils`).subscribe((rows) => this.tools.set(rows));
    this.http.get<Manufacturer[]>(`${environment.apiUrl}/utils/manufacturers`).subscribe((rows) => this.manufacturers.set(rows));
    this.http.get<UserItem[]>(`${environment.apiUrl}/users`).subscribe((rows) => this.users.set(rows));
    this.http.get<AddressItem[]>(`${environment.apiUrl}/users/addresses`, { headers: this.authHeaders() }).subscribe((rows) => this.addresses.set(rows));
  }

  addTool(): void {
    if (!this.nom.trim() || !this.marque_id || !this.owner_user_id || !this.localisation_address_id) {
      this.toast.error('Nom, marque, proprietaire et localisation sont obligatoires');
      return;
    }

    const token = this.auth.token();
    if (!token) {
      this.toast.error('Session invalide');
      return;
    }

    this.http
      .post(
        `${environment.apiUrl}/utils`,
        {
          nom: this.nom.trim(),
          categorie: this.categorie,
          description: this.description.trim(),
          marque_id: this.marque_id,
          localisation_address_id: this.localisation_address_id,
          owner_user_id: this.owner_user_id,
          borrowed_by_user_id: this.borrowed_by_user_id || undefined,
          etat: this.etat,
          disponible: this.borrowed_by_user_id ? false : this.disponible
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.nom = '';
          this.description = '';
          this.localisation_address_id = '';
          this.borrowed_by_user_id = '';
          this.disponible = true;
          this.toast.success('Outil ajoute');
          this.loadData();
        },
        error: () => this.toast.error('Impossible d\'ajouter l\'outil')
      });
  }

  displayUser(user: UserItem | null): string {
    if (!user) return '-';
    return `${user.first_name} ${user.last_name}`;
  }
}
