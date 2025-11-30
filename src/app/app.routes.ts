import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
    },
    {
        path: 'add-transaction',
        loadComponent: () => import('./features/add-transaction/add-transaction.component').then(m => m.AddTransactionComponent)
    },
    {
        path: 'categories',
        loadComponent: () => import('./features/category-manager/category-list/category-list.component').then(m => m.CategoryListComponent)
    },
    {
        path: 'categories/new',
        loadComponent: () => import('./features/category-manager/category-form/category-form.component').then(m => m.CategoryFormComponent)
    },
    {
        path: 'categories/:id',
        loadComponent: () => import('./features/category-manager/category-form/category-form.component').then(m => m.CategoryFormComponent)
    },
    {
        path: 'edit-transaction/:id',
        loadComponent: () => import('./features/add-transaction/add-transaction.component').then(m => m.AddTransactionComponent)
    }
];
