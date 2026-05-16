import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

type ToolCategory = 'jardin' | 'placo' | 'electricite' | 'bois' | 'eau';

interface ToolItem {
  id: string;
  nom: string;
  categorie: ToolCategory;
}

type BorrowingStatus = 'pending' | 'active' | 'finished' | 'rejected';

interface BorrowingItem {
  id: string;
  tool_id: string;
  start_date: string;
  end_date: string;
  borrower_user_id: string;
  owner_user_id: string;
  status: BorrowingStatus;
}

interface UserItem {
  id: string;
  first_name: string;
  last_name: string;
}

@Component({
  selector: 'app-user-borrowed-tools-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './user-borrowed-tools.page.html',
  styleUrl: './user-borrowed-tools.page.scss'
})
export class UserBorrowedToolsPage implements OnInit {
  tools = signal<ToolItem[]>([]);
  borrowings = signal<BorrowingItem[]>([]);
  users = signal<UserItem[]>([]);
  activeTab = signal<'lent' | 'to_validate' | 'borrowed'>('lent');

  myLentObjects = computed(() => {
    const userId = this.auth.userId();
    return this.borrowings().filter((item) => item.owner_user_id === userId && item.status !== 'pending');
  });

  toValidate = computed(() => {
    const userId = this.auth.userId();
    return this.borrowings().filter((item) => item.owner_user_id === userId && item.status === 'pending');
  });

  myBorrowedObjects = computed(() => {
    const userId = this.auth.userId();
    return this.borrowings().filter((item) => item.borrower_user_id === userId);
  });

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  private loadData(): void {
    this.http.get<ToolItem[]>(`${environment.apiUrl}/utils`).subscribe((rows) => this.tools.set(rows));
    this.http.get<UserItem[]>(`${environment.apiUrl}/users`).subscribe((rows) => this.users.set(rows));
    this.http
      .get<BorrowingItem[]>(`${environment.apiUrl}/borrowings`, { headers: this.authHeaders() })
      .subscribe({
        next: (rows) => this.borrowings.set(rows),
        error: () => this.toast.error('Impossible de charger les emprunts')
      });
  }

  toolName(toolId: string): string {
    return this.tools().find((tool) => tool.id === toolId)?.nom ?? `Outil ${toolId}`;
  }

  userName(userId: string): string {
    const user = this.users().find((row) => row.id === userId);
    if (!user) return '-';
    return `${user.first_name} ${user.last_name}`;
  }

  statusLabel(status: BorrowingStatus): string {
    if (status === 'pending') return 'En attente';
    if (status === 'active') return 'En cours';
    if (status === 'rejected') return 'Refuse';
    return 'Termine';
  }

  setTab(tab: 'lent' | 'to_validate' | 'borrowed'): void {
    this.activeTab.set(tab);
  }

  activateBorrowing(id: string): void {
    this.http
      .put(
        `${environment.apiUrl}/borrowings/${id}/status`,
        { status: 'active' },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Emprunt valide');
          this.loadData();
        },
        error: () => this.toast.error('Impossible de valider cet emprunt')
      });
  }

  rejectBorrowing(id: string): void {
    this.http
      .put(
        `${environment.apiUrl}/borrowings/${id}/status`,
        { status: 'rejected' },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Demande refusee');
          this.loadData();
        },
        error: () => this.toast.error('Impossible de refuser cette demande')
      });
  }

  finishBorrowing(id: string): void {
    this.http
      .put(
        `${environment.apiUrl}/borrowings/${id}/status`,
        { status: 'finished' },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Emprunt marque comme termine');
          this.loadData();
        },
        error: () => this.toast.error('Impossible de terminer cet emprunt')
      });
  }
}
