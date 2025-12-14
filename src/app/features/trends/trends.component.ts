import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { UserService } from '../../core/services/user.service';
import { Category } from '../../core/models/models';

interface MonthlyTopSpending {
    month: string;
    monthLabel: string;
    year: number;
    topItems: {
        category: Category;
        amount: number;
        percentage: number;
    }[];
    totalExpense: number;
}

@Component({
    selector: 'app-trends',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './trends.component.html',
    styles: []
})
export class TrendsComponent {
    transactionService = inject(TransactionService);
    categoryService = inject(CategoryService);
    userService = inject(UserService);
    private router = inject(Router);

    // Selected user filter (null = all users)
    selectedUserId = signal<string | null>(null);
    showUserDropdown = signal(false);

    // Selected category for detail view
    selectedCategory = signal<Category | null>(null);

    // Get unique users from transactions
    availableUsers = computed(() => {
        const transactions = this.transactionService.transactions();
        const userIds = new Set<string>();
        
        transactions.forEach(t => {
            if (t.userId) {
                userIds.add(t.userId);
            }
        });
        
        return Array.from(userIds).map(userId => ({
            id: userId,
            name: this.userService.getUserName(userId)
        }));
    });

    // Last 6 months top 5 spending
    last6MonthsTopSpending = computed<MonthlyTopSpending[]>(() => {
        const allTransactions = this.transactionService.transactions();
        const userId = this.selectedUserId();
        
        // Filter by user if selected
        let transactions = userId 
            ? allTransactions.filter(t => t.userId === userId)
            : allTransactions;
        
        // Get expense transactions only
        transactions = transactions.filter(t => t.type === 'expense');

        const now = new Date();
        const months: MonthlyTopSpending[] = [];

        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
            const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short' });
            
            // Filter transactions for this month
            const monthTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate.getMonth() === monthDate.getMonth() && 
                       tDate.getFullYear() === monthDate.getFullYear();
            });

            // Calculate category totals
            const categoryTotals = new Map<string, number>();
            monthTransactions.forEach(t => {
                const current = categoryTotals.get(t.categoryId) || 0;
                categoryTotals.set(t.categoryId, current + t.amount);
            });

            const totalExpense = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

            // Get top 5 categories
            const topItems = Array.from(categoryTotals.entries())
                .map(([categoryId, amount]) => {
                    const category = this.categoryService.categories().find(c => c.id === categoryId);
                    return category ? {
                        category,
                        amount,
                        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
                    } : null;
                })
                .filter(item => item !== null)
                .sort((a, b) => b!.amount - a!.amount)
                .slice(0, 5) as MonthlyTopSpending['topItems'];

            months.push({
                month: monthKey,
                monthLabel,
                year: monthDate.getFullYear(),
                topItems,
                totalExpense
            });
        }

        return months;
    });

    // Total expense across all 6 months
    totalExpense6Months = computed(() => {
        return this.last6MonthsTopSpending().reduce((sum, m) => sum + m.totalExpense, 0);
    });

    // Average monthly expense
    averageMonthlyExpense = computed(() => {
        const months = this.last6MonthsTopSpending().filter(m => m.totalExpense > 0);
        if (months.length === 0) return 0;
        return this.totalExpense6Months() / months.length;
    });

    // Category transactions for detail view
    categoryTransactions = computed(() => {
        const category = this.selectedCategory();
        if (!category) return [];
        
        const userId = this.selectedUserId();
        let transactions = this.transactionService.transactions()
            .filter(t => t.categoryId === category.id && t.type === 'expense');
        
        if (userId) {
            transactions = transactions.filter(t => t.userId === userId);
        }
        
        // Filter to last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        return transactions
            .filter(t => new Date(t.date) >= sixMonthsAgo)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    categoryTotal = computed(() => {
        return this.categoryTransactions().reduce((sum, t) => sum + t.amount, 0);
    });

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

    selectCategory(category: Category) {
        this.selectedCategory.set(category);
    }

    closeDetail() {
        this.selectedCategory.set(null);
    }

    editTransaction(id: string) {
        this.router.navigate(['/edit-transaction', id]);
    }
}

