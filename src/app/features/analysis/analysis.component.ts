import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { UserService } from '../../core/services/user.service';
import { Category, Transaction } from '../../core/models/models';

interface PieSlice {
    category: Category;
    amount: number;
    percentage: number;
    startAngle: number;
    endAngle: number;
    path: string;
    labelX: number;
    labelY: number;
}

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

    // Pie chart slices for current month expenses
    pieChartSlices = computed<PieSlice[]>(() => {
        const stats = this.categoryStats();
        if (stats.length === 0) return [];

        const slices: PieSlice[] = [];
        let currentAngle = -90; // Start at top

        stats.forEach(stat => {
            const angleSize = (stat.percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angleSize;

            // Calculate path for pie slice
            const path = this.describeArc(100, 100, 80, startAngle, endAngle);
            
            // Calculate label position (middle of the arc)
            const labelAngle = startAngle + angleSize / 2;
            const labelRadius = 50; // Distance from center for label
            const labelX = 100 + labelRadius * Math.cos((labelAngle * Math.PI) / 180);
            const labelY = 100 + labelRadius * Math.sin((labelAngle * Math.PI) / 180);

            slices.push({
                category: stat.category,
                amount: stat.amount,
                percentage: stat.percentage,
                startAngle,
                endAngle,
                path,
                labelX,
                labelY
            });

            currentAngle = endAngle;
        });

        return slices;
    });

    // Helper function to create SVG arc path
    private describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
        const start = this.polarToCartesian(x, y, radius, endAngle);
        const end = this.polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

        return [
            'M', x, y,
            'L', start.x, start.y,
            'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
            'Z'
        ].join(' ');
    }

    private polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians)
        };
    }

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
