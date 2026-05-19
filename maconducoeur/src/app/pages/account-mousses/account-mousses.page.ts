import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface PendingIOweItem {
  borrowing_id: string;
  tool_id: string;
  mousse_amount: number;
  to_user_id: string;
  to_user_name: string;
  created_at: string;
}

interface PendingOwedToMeItem {
  borrowing_id: string;
  tool_id: string;
  mousse_amount: number;
  from_user_id: string;
  from_user_name: string;
  created_at: string;
}

interface MoussesResponse {
  credits: number;
  totals: {
    i_owe: number;
    owed_to_me: number;
  };
  i_owe: PendingIOweItem[];
  owed_to_me: PendingOwedToMeItem[];
}

@Component({
  selector: 'app-account-mousses-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './account-mousses.page.html',
  styleUrl: './account-mousses.page.scss'
})
export class AccountMoussesPage implements OnInit {
  data = signal<MoussesResponse | null>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  load(): void {
    this.http
      .get<MoussesResponse>(`${environment.apiUrl}/users/me/mousses`, { headers: this.authHeaders() })
      .subscribe({
        next: (payload) => this.data.set(payload),
        error: () => this.toast.error('Impossible de charger les mousses')
      });
  }
}
