import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

type ToolCategory = 'jardin' | 'placo' | 'electricite' | 'bois' | 'eau';

interface ToolItem {
  id: string;
  nom: string;
  categorie: ToolCategory;
  description: string | null;
  marque: string | null;
  image_url: string | null;
  owner_user: { id: string; first_name: string; last_name: string; email: string } | null;
  borrowed_by_user: { id: string; first_name: string; last_name: string; email: string } | null;
  etat: 'neuf' | 'bon' | 'use';
  disponible: boolean;
}

@Component({
  selector: 'app-user-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user.page.html',
  styleUrl: './user.page.scss'
})
export class UserPage implements OnInit {
  tools = signal<ToolItem[]>([]);
  search = signal('');
  statusFilter = signal<'all' | 'available' | 'borrowed'>('all');

  filteredTools = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.tools().filter((tool) => {
      if (status === 'available' && !tool.disponible) return false;
      if (status === 'borrowed' && tool.disponible) return false;
      if (!q) return true;
      const owner = this.displayUser(tool.owner_user).toLowerCase();
      const borrower = this.displayUser(tool.borrowed_by_user).toLowerCase();
      return tool.nom.toLowerCase().includes(q) || owner.includes(q) || borrower.includes(q);
    });
  });

  private readonly categoryMeta: Record<ToolCategory, { icon: string; label: string }> = {
    jardin: { icon: 'yard', label: 'Jardin' },
    placo: { icon: 'view_in_ar', label: 'Placo' },
    electricite: { icon: 'electric_bolt', label: 'Electricite' },
    bois: { icon: 'carpenter', label: 'Bois' },
    eau: { icon: 'plumbing', label: 'Eau' }
  };

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.http
      .get<ToolItem[]>(`${environment.apiUrl}/utils`)
      .subscribe((rows) => this.tools.set(rows.sort((a, b) => Number(b.disponible) - Number(a.disponible))));
  }

  iconForCategory(category: ToolCategory): string {
    return this.categoryMeta[category]?.icon ?? 'construction';
  }

  labelForCategory(category: ToolCategory): string {
    return this.categoryMeta[category]?.label ?? category;
  }

  fullImageUrl(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const apiBase = environment.apiUrl.replace(/\/api$/, '');
    return `${apiBase}${path}`;
  }

  displayUser(user: ToolItem['owner_user']): string {
    if (!user) return '-';
    return `${user.first_name} ${user.last_name}`;
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  setStatusFilter(value: 'all' | 'available' | 'borrowed'): void {
    this.statusFilter.set(value);
  }

  reserve(tool: ToolItem): void {
    if (!tool.disponible) return;
    this.router.navigateByUrl(`/utilisateur/utils/catalogue/${tool.id}/reservation`);
  }
}
