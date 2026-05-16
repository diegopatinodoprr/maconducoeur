import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface ToolItem {
  id: string;
  nom: string;
  disponible: boolean;
  owner_user: { id: string; first_name: string; last_name: string } | null;
}

@Component({
  selector: 'app-user-reservation-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './user-reservation.page.html',
  styleUrl: './user-reservation.page.scss'
})
export class UserReservationPage implements OnInit {
  tool = signal<ToolItem | null>(null);

  startDate = '';
  endDate = '';

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    const toolId = this.route.snapshot.paramMap.get('id');
    if (!toolId) {
      this.toast.error('Outil introuvable');
      this.router.navigateByUrl('/utilisateur/utils/catalogue');
      return;
    }

    this.http.get<ToolItem[]>(`${environment.apiUrl}/utils`).subscribe({
      next: (rows) => {
        const found = rows.find((row) => row.id === toolId) ?? null;
        this.tool.set(found);
        if (!found) {
          this.toast.error('Outil introuvable');
          this.router.navigateByUrl('/utilisateur/utils/catalogue');
        }
      },
      error: () => this.toast.error('Impossible de charger l\'outil')
    });
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  submitReservation(): void {
    const currentTool = this.tool();
    if (!currentTool) return;

    if (!this.startDate || !this.endDate) {
      this.toast.error('Date de debut et de fin obligatoires');
      return;
    }

    this.http
      .post(
        `${environment.apiUrl}/borrowings`,
        {
          tool_id: currentTool.id,
          start_date: this.startDate,
          end_date: this.endDate
        },
        { headers: this.authHeaders() }
      )
      .subscribe({
        next: () => {
          this.toast.success('Demande d\'emprunt envoyee (en attente de validation)');
          this.router.navigateByUrl('/utilisateur/utils/mes-emprunts');
        },
        error: () => this.toast.error('Impossible d\'envoyer la demande d\'emprunt')
      });
  }
}
