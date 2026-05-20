import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/toast/toast.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected sidenavOpen = false;

  constructor(
    protected readonly auth: AuthService,
    private readonly router: Router
  ) {}

  protected isLoginRoute(): boolean {
    return this.router.url === '/';
  }

  toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }

  closeSidenav(): void {
    this.sidenavOpen = false;
  }

  logout(): void {
    this.auth.logout();
    this.sidenavOpen = false;
    this.router.navigateByUrl('/');
  }
}
