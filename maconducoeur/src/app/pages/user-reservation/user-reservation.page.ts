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
  estimatedMousses = signal<number>(1);

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
    this.estimatedMousses.set(this.computeMousses(this.startDate, this.endDate));

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
          this.toast.success(`Demande envoyee: ${this.estimatedMousses()} mousse(s) reservee(s)`);
          this.router.navigateByUrl('/utilisateur/utils/mes-emprunts');
        },
        error: () => this.toast.error('Impossible d\'envoyer la demande d\'emprunt')
      });
  }

  updateEstimate(): void {
    if (!this.startDate || !this.endDate) return;
    this.estimatedMousses.set(this.computeMousses(this.startDate, this.endDate));
  }

  private computeMousses(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationMs = end.getTime() - start.getTime();
    if (Number.isNaN(durationMs) || durationMs <= 0) return 1;
    const days = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
    return Math.max(1, Math.ceil(days / 7));
  }
}
