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

interface ChartBar {
    month: string;
    monthLabel: string;
    year: number;
    amount: number;
    percentage: number; // Percentage of max value (for bar height)
    x: number;
    barWidth: number;
    barHeight: number;
    y: number;
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

    // Time period options
    readonly periodOptions = [
        { value: 3, label: '3 Months' },
        { value: 6, label: '6 Months' },
        { value: 12, label: '12 Months' }
    ];
    selectedPeriod = signal(6); // Default 6 months

    // Selected user filter (null = all users)
    selectedUserId = signal<string | null>(null);
    showUserDropdown = signal(false);

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

    // Top spending by month for selected period
    monthlyTopSpending = computed<MonthlyTopSpending[]>(() => {
        const allTransactions = this.transactionService.transactions();
        const userId = this.selectedUserId();
        const period = this.selectedPeriod();
        
        // Filter by user if selected
        let transactions = userId 
            ? allTransactions.filter(t => t.userId === userId)
            : allTransactions;
        
        // Get expense transactions only
        transactions = transactions.filter(t => t.type === 'expense');

        const now = new Date();
        const months: MonthlyTopSpending[] = [];

        for (let i = 0; i < period; i++) {
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

    // Total expense across selected period
    totalExpenseForPeriod = computed(() => {
        return this.monthlyTopSpending().reduce((sum, m) => sum + m.totalExpense, 0);
    });

    // Average monthly expense
    averageMonthlyExpense = computed(() => {
        const months = this.monthlyTopSpending().filter(m => m.totalExpense > 0);
        if (months.length === 0) return 0;
        return this.totalExpenseForPeriod() / months.length;
    });

    // Max monthly expense (for chart scaling)
    maxMonthlyExpense = computed(() => {
        return Math.max(...this.monthlyTopSpending().map(m => m.totalExpense), 1);
    });

    // Chart bar data (reversed to show oldest first, left to right)
    chartBars = computed<ChartBar[]>(() => {
        const data = [...this.monthlyTopSpending()].reverse();
        const maxExpense = this.maxMonthlyExpense();
        const chartWidth = 300;
        const chartHeight = 150;
        const barGap = 4;
        const numBars = data.length;
        const barWidth = Math.max(8, (chartWidth - (numBars - 1) * barGap) / numBars);

        return data.map((m, index) => {
            const percentage = maxExpense > 0 ? (m.totalExpense / maxExpense) * 100 : 0;
            const barHeight = (percentage / 100) * chartHeight;
            
            return {
                month: m.month,
                monthLabel: m.monthLabel,
                year: m.year,
                amount: m.totalExpense,
                percentage,
                x: index * (barWidth + barGap),
                barWidth,
                barHeight: Math.max(barHeight, 2), // Minimum height for visibility
                y: chartHeight - barHeight
            };
        });
    });

    // Set time period
    setPeriod(months: number) {
        this.selectedPeriod.set(months);
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

    // Navigate to analysis page with specific month selected
    goToMonthAnalysis(monthLabel: string, year: number) {
        // Find the month index (0-11) from the label
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.indexOf(monthLabel);
        
        if (monthIndex !== -1) {
            // Set the transaction service to monthly view with the selected month
            this.transactionService.filterState.set('monthly');
            this.transactionService.currentDate.set(new Date(year, monthIndex, 1));
            this.router.navigate(['/analysis']);
        }
    }
}

