import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { Category, Transaction } from '../../core/models/models';

@Component({
    selector: 'app-analysis',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './analysis.component.html',
    styles: []
})
export class AnalysisComponent {
    transactionService = inject(TransactionService);
    categoryService = inject(CategoryService);
    private router = inject(Router);

    // Selected category for detail view
    selectedCategory = signal<Category | null>(null);

    // Transactions for the selected category
    categoryTransactions = computed(() => {
        const category = this.selectedCategory();
        if (!category) return [];
        
        return this.transactionService.filteredTransactions()
            .filter(t => t.categoryId === category.id && t.type === 'expense')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    // Total for the selected category
    categoryTotal = computed(() => {
        return this.categoryTransactions().reduce((sum, t) => sum + t.amount, 0);
    });

    // Computed stats for the analysis view
    categoryStats = computed(() => {
        const transactions = this.transactionService.filteredTransactions().filter(t => t.type === 'expense');
        const totalExpense = transactions.reduce((sum, t) => sum + t.amount, 0);

        const statsMap = new Map<string, number>();

        transactions.forEach(t => {
            const current = statsMap.get(t.categoryId) || 0;
            statsMap.set(t.categoryId, current + t.amount);
        });

        const stats = [];
        for (const [categoryId, amount] of statsMap.entries()) {
            const category = this.categoryService.categories().find(c => c.id === categoryId);
            if (category) {
                stats.push({
                    category,
                    amount,
                    percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
                });
            }
        }

        return stats.sort((a, b) => b.amount - a.amount);
    });

    // Re-use date navigation logic or just expose service methods if needed
    // For now, we'll bind directly to service signals in template or use simple wrappers

    prevPeriod() {
        const current = new Date(this.transactionService.currentDate());
        const filter = this.transactionService.filterState();

        switch (filter) {
            case 'daily':
                current.setDate(current.getDate() - 1);
                break;
            case 'monthly':
                current.setMonth(current.getMonth() - 1);
                break;
        }
        this.transactionService.currentDate.set(current);
    }

    nextPeriod() {
        const current = new Date(this.transactionService.currentDate());
        const filter = this.transactionService.filterState();

        switch (filter) {
            case 'daily':
                current.setDate(current.getDate() + 1);
                break;
            case 'monthly':
                current.setMonth(current.getMonth() + 1);
                break;
        }
        this.transactionService.currentDate.set(current);
    }

    setFilter(filter: 'daily' | 'monthly') {
        this.transactionService.filterState.set(filter);
        this.transactionService.currentDate.set(new Date());
    }

    // Date picker helpers
    onDateChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.value) {
            this.transactionService.currentDate.set(new Date(input.value));
        }
    }

    onMonthChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.value) {
            const [year, month] = input.value.split('-').map(Number);
            const newDate = new Date(year, month - 1, 1);
            this.transactionService.currentDate.set(newDate);
        }
    }

    get currentDateStr() {
        const date = this.transactionService.currentDate();
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    }

    get currentMonthStr() {
        const date = this.transactionService.currentDate();
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    // Select a category to show its transactions
    selectCategory(category: Category) {
        this.selectedCategory.set(category);
    }

    // Close the category detail view
    closeDetail() {
        this.selectedCategory.set(null);
    }

    // Navigate to edit a transaction
    editTransaction(id: string) {
        this.router.navigate(['/edit-transaction', id]);
    }
}
