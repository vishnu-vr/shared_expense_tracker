import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { UserService } from '../../core/services/user.service';
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
    userService = inject(UserService);
    private router = inject(Router);

    // Selected category for detail view
    selectedCategory = signal<Category | null>(null);
    
    // Selected user filter (null = all users)
    selectedUserId = signal<string | null>(null);
    showUserDropdown = signal(false);

    // Get unique users from transactions (use UserService to get names)
    availableUsers = computed(() => {
        const transactions = this.transactionService.transactions();
        const userIds = new Set<string>();
        
        // Collect unique user IDs from transactions
        transactions.forEach(t => {
            if (t.userId) {
                userIds.add(t.userId);
            }
        });
        
        // Map to user objects with names from UserService
        return Array.from(userIds).map(userId => ({
            id: userId,
            name: this.userService.getUserName(userId)
        }));
    });

    // Filtered transactions based on user selection
    userFilteredTransactions = computed(() => {
        const userId = this.selectedUserId();
        let transactions = this.transactionService.filteredTransactions();
        
        if (userId) {
            transactions = transactions.filter(t => t.userId === userId);
        }
        
        return transactions;
    });

    // Transactions for the selected category (with user filter)
    categoryTransactions = computed(() => {
        const category = this.selectedCategory();
        if (!category) return [];
        
        return this.userFilteredTransactions()
            .filter(t => t.categoryId === category.id && t.type === 'expense')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    // Total for the selected category
    categoryTotal = computed(() => {
        return this.categoryTransactions().reduce((sum, t) => sum + t.amount, 0);
    });

    // Total expense with user filter
    totalExpenseFiltered = computed(() => {
        return this.userFilteredTransactions()
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
    });

    // Computed stats for the analysis view (with user filter)
    categoryStats = computed(() => {
        const transactions = this.userFilteredTransactions().filter(t => t.type === 'expense');
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

    // User filter methods
    selectUser(userId: string | null) {
        this.selectedUserId.set(userId);
        this.showUserDropdown.set(false);
    }

    toggleUserDropdown() {
        this.showUserDropdown.update(v => !v);
    }

    getSelectedUserName(): string {
        const userId = this.selectedUserId();
        if (!userId) return 'All Users';
        
        return this.userService.getUserName(userId);
    }

    getUserDisplayName(userId: string): string {
        return this.userService.getUserName(userId);
    }
}
