import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { Transaction } from '../../core/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  transactionService = inject(TransactionService);
  categoryService = inject(CategoryService);
  private router = inject(Router);

  groupedTransactions = computed(() => {
    const transactions = this.transactionService.filteredTransactions();
    const groups: { date: string; total: number; transactions: Transaction[] }[] = [];

    transactions.forEach(t => {
      const dateStr = new Date(t.date).toDateString();
      let group = groups.find(g => g.date === dateStr);
      if (!group) {
        group = { date: dateStr, total: 0, transactions: [] };
        groups.push(group);
      }
      group.transactions.push(t);
      if (t.type === 'expense') {
        group.total -= t.amount;
      } else {
        group.total += t.amount;
      }
    });

    return groups;
  });

  setFilter(filter: 'daily' | 'monthly' | 'all') {
    this.transactionService.filterState.set(filter);
    // Reset date to today when switching filters (optional, but good UX)
    this.transactionService.currentDate.set(new Date());
  }

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

  editTransaction(id: string) {
    this.router.navigate(['/edit-transaction', id]);
  }

  getCategory(id: string) {
    return this.categoryService.categories().find(c => c.id === id);
  }

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
    // Ensure we get the local date string in YYYY-MM-DD format
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  }

  get currentMonthStr() {
    const date = this.transactionService.currentDate();
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}
