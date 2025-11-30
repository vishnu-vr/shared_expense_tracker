import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { Transaction } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class TransactionService {
    private storage = inject(StorageService);

    // Signals
    transactions = signal<Transaction[]>([]);
    filterState = signal<'daily' | 'monthly' | 'all'>('daily'); // Default to daily as per design
    currentDate = signal<Date>(new Date());

    // Computed
    filteredTransactions = computed(() => {
        const all = this.transactions();
        const filter = this.filterState();
        const current = new Date(this.currentDate());
        const currentDay = new Date(current.getFullYear(), current.getMonth(), current.getDate());

        return all.filter(t => {
            const tDate = new Date(t.date);
            const tDateOnly = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());

            switch (filter) {
                case 'daily':
                    return tDateOnly.getTime() === currentDay.getTime();
                case 'monthly':
                    return tDate.getMonth() === currentDay.getMonth() && tDate.getFullYear() === currentDay.getFullYear();
                default:
                    return true;
            }
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    totalIncome = computed(() =>
        this.filteredTransactions()
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)
    );

    totalExpense = computed(() =>
        this.filteredTransactions()
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0)
    );

    balance = computed(() => this.totalIncome() - this.totalExpense());

    constructor() {
        this.loadTransactions();
    }

    async loadTransactions() {
        const data = await this.storage.getAllTransactions();
        this.transactions.set(data);
    }

    async addTransaction(transaction: Omit<Transaction, 'id'>) {
        const newTransaction: Transaction = {
            ...transaction,
            id: crypto.randomUUID(),
            date: new Date(transaction.date) // Ensure date object
        };

        await this.storage.addTransaction(newTransaction);
        this.transactions.update(ts => [...ts, newTransaction]);
    }

    async updateTransaction(transaction: Transaction) {
        await this.storage.addTransaction(transaction); // put overwrites
        this.transactions.update(t => t.map(tr => tr.id === transaction.id ? transaction : tr));
    }

    async deleteTransaction(id: string) {
        await this.storage.deleteTransaction(id);
        this.transactions.update(t => t.filter(tr => tr.id !== id));
    }
}
