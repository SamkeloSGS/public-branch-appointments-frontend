import type { Routes } from '@angular/router'

/** Customer-area routes of branch management: the branch page, which is the home page (spec 5). */
export const branchManagementRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'branchManagement.detailTitle',
    loadComponent: () => import('./feature/branch-detail-page').then((m) => m.BranchDetailPage),
  },
]
