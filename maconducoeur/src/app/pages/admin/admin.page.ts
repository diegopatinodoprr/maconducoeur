import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

interface DbUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'user';
}

@Component({
  selector: 'app-admin-page',
  standalone: true,
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.scss'
})
export class AdminPage implements OnInit {
  users = signal<DbUser[]>([]);

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.http
      .get<DbUser[]>(`${environment.apiUrl}/users`)
      .subscribe((rows) => this.users.set(rows));
  }
}
