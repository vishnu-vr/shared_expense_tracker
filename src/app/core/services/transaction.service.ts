import { Injectable, inject, signal, computed } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, deleteDoc, updateDoc, setDoc, query, orderBy, where, onSnapshot } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { Transaction } from '../models/models';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class TransactionService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private notificationService = inject(NotificationService);
    private transactionsCollection = collection(this.firestore, 'transactions');

    // Signals
    transactions = signal<Transaction[]>([]);
    filterState = signal<'daily' | 'monthly'>('daily');
    currentDate = signal(new Date());

    // Computed
    filteredTransactions = computed(() => {
        const all = this.transactions();
        const filter = this.filterState();
        const date = this.currentDate();

        return all.filter(t => {
            const tDate = new Date(t.date);
            if (filter === 'daily') {
                return tDate.toDateString() === date.toDateString();
            } else {
                return tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear();
            }
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    totalIncome = computed(() => this.filteredTransactions()
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0));

    totalExpense = computed(() => this.filteredTransactions()
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0));

    balance = computed(() => this.totalIncome() - this.totalExpense());

    constructor() {
        this.loadTransactions();
    }

    private loadTransactions() {
        this.authService.user$.pipe(
            switchMap(user => {
                if (user) {
                    // Fetch ALL transactions ordered by date
                    const q = query(this.transactionsCollection, orderBy('date', 'desc'));
                    return new Observable<Transaction[]>(observer => {
                        const unsubscribe = onSnapshot(q, (snapshot) => {
                            const transactions = snapshot.docs.map(doc => {
                                const data = doc.data();
                                return {
                                    id: doc.id,
                                    ...data,
                                    date: (data['date'] as any).toDate ? (data['date'] as any).toDate() : new Date(data['date'])
                                } as Transaction;
                            });
                            observer.next(transactions);
                        }, (error) => {
                            console.error('Error loading transactions:', error);
                            observer.error(error);
                        });
                        return () => unsubscribe();
                    }).pipe(
                        catchError(err => {
                            console.error('Error in transaction stream:', err);
                            return of([]);
                        })
                    );
                } else {
                    return of([]);
                }
            })
        ).subscribe(transactions => {
            this.transactions.set(transactions);
        });
    }

    async addTransaction(transaction: Omit<Transaction, 'id'>) {
        const user = this.authService.currentUser();
        if (!user) throw new Error('User not authenticated');

        const newTransaction = {
            ...transaction,
            userId: user.uid,
            userEmail: user.email || undefined,
            date: new Date(transaction.date).toISOString() // Store as ISO string for simplicity or Timestamp
        };
        
        // Generate document ID locally so we don't have to wait for the write
        const docRef = doc(this.transactionsCollection);
        const transactionOp = setDoc(docRef, newTransaction);
        
        // Create notification for other users
        const userName = user.displayName || user.email || 'Someone';
        const typeLabel = transaction.type === 'income' ? 'income' : 'expense';
        const message = `${userName} added a new ${typeLabel} of ₹${transaction.amount.toLocaleString('en-IN')}`;
        const notificationOp = this.notificationService.createNotification(
            'transaction_added',
            message,
            docRef.id
        );
        
        // If offline, return immediately - Firestore will sync when back online
        if (!navigator.onLine) return;
        
        // If online, wait for both operations
        await Promise.all([transactionOp, notificationOp]);
    }

    async updateTransaction(transaction: Transaction) {
        const docRef = doc(this.firestore, 'transactions', transaction.id);
        const { id, ...data } = transaction;
        const op = updateDoc(docRef, {
            ...data,
            date: new Date(data.date).toISOString()
        });
        if (!navigator.onLine) return;
        await op;
    }

    async deleteTransaction(id: string) {
        const docRef = doc(this.firestore, 'transactions', id);
        const op = deleteDoc(docRef);
        if (!navigator.onLine) return;
        await op;
    }

    // Date Navigation Helpers
    nextPeriod() {
        const date = new Date(this.currentDate());
        if (this.filterState() === 'daily') {
            date.setDate(date.getDate() + 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
        this.currentDate.set(date);
    }

    prevPeriod() {
        const date = new Date(this.currentDate());
        if (this.filterState() === 'daily') {
            date.setDate(date.getDate() - 1);
        } else {
            date.setMonth(date.getMonth() - 1);
        }
        this.currentDate.set(date);
    }

    setFilter(filter: 'daily' | 'monthly') {
        this.filterState.set(filter);
        this.currentDate.set(new Date());
    }

    setDate(date: Date) {
        this.currentDate.set(date);
    }
}
