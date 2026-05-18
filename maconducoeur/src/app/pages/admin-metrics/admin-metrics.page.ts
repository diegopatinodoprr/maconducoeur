import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { RealtimeService } from '../../services/realtime.service';
import { ToastService } from '../../services/toast.service';

interface ConnectionMetric {
  id: string;
  user_id: string;
  email: string;
  role: 'admin' | 'user';
  connected_at: string;
  ip: string | null;
  user_agent: string | null;
}

@Component({
  selector: 'app-admin-metrics-page',
  standalone: true,
  templateUrl: './admin-metrics.page.html',
  styleUrl: './admin-metrics.page.scss'
})
export class AdminMetricsPage implements OnInit {
  readonly connections = signal<ConnectionMetric[]>([]);
  readonly loading = signal(false);

  readonly connectionsLast24h = computed(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return this.connections().filter((row) => new Date(row.connected_at).getTime() >= since).length;
  });

  readonly connectionsLast7d = computed(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.connections().filter((row) => new Date(row.connected_at).getTime() >= since).length;
  });

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly realtime: RealtimeService,
    private readonly destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.loadConnections();
    this.realtime.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.type === 'connection.created') {
          this.loadConnections();
        }
      });
  }

  loadConnections(): void {
    const token = this.auth.token();
    if (!token) {
      this.toast.error('Session invalide');
      return;
    }

    this.loading.set(true);
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get<ConnectionMetric[]>(`${environment.apiUrl}/admin/metrics/connections?limit=200`, { headers }).subscribe({
      next: (rows) => {
        this.connections.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Impossible de charger les metrics');
        this.loading.set(false);
      }
    });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('fr-FR');
  }
}
