import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { AccountAddressesPage } from './pages/account-addresses/account-addresses.page';
import { AccountSecurityPage } from './pages/account-security/account-security.page';
import { AccountPage } from './pages/account/account.page';
import { AdminManufacturersPage } from './pages/admin-manufacturers/admin-manufacturers.page';
import { AdminMetricsPage } from './pages/admin-metrics/admin-metrics.page';
import { AdminToolsPage } from './pages/admin-tools/admin-tools.page';
import { AdminPage } from './pages/admin/admin.page';
import { LoginPage } from './pages/login/login.page';
import { UserBorrowedToolsPage } from './pages/user-borrowed-tools/user-borrowed-tools.page';
import { UserReservationPage } from './pages/user-reservation/user-reservation.page';
import { UserToolsManagePage } from './pages/user-tools-manage/user-tools-manage.page';
import { UserPage } from './pages/user/user.page';

export const routes: Routes = [
  { path: '', component: LoginPage },
  { path: 'compte', component: AccountPage, canActivate: [authGuard] },
  { path: 'compte/adresses', component: AccountAddressesPage, canActivate: [authGuard] },
  { path: 'compte/securite', component: AccountSecurityPage, canActivate: [authGuard] },
  { path: 'utilisateur', redirectTo: 'utilisateur/utils/mes-outils', pathMatch: 'full' },
  { path: 'utilisateur/utils', redirectTo: 'utilisateur/utils/mes-outils', pathMatch: 'full' },
  { path: 'utilisateur/utils/mes-outils', component: UserToolsManagePage, canActivate: [authGuard] },
  { path: 'utilisateur/utils/catalogue', component: UserPage, canActivate: [authGuard] },
  { path: 'utilisateur/utils/catalogue/:id/reservation', component: UserReservationPage, canActivate: [authGuard] },
  { path: 'utilisateur/utils/mes-emprunts', component: UserBorrowedToolsPage, canActivate: [authGuard] },
  { path: 'admin', component: AdminPage, canActivate: [adminGuard] },
  { path: 'admin/metrics', component: AdminMetricsPage, canActivate: [adminGuard] },
  { path: 'admin/utils', component: AdminToolsPage, canActivate: [adminGuard] },
  { path: 'admin/marques', component: AdminManufacturersPage, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
