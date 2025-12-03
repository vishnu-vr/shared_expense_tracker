export type TransactionType = 'income' | 'expense';

export interface Transaction {
    id: string;
    amount: number;
    categoryId: string;
    accountId?: string; // Optional for now
    date: Date;
    note?: string;
    type: TransactionType;
    userId?: string; // Added for Firestore ownership
}

export interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
    type: TransactionType;
}

export interface Account {
    id: string;
    name: string;
    type: string;
    balance: number;
}

export interface Budget {
    id: string;
    categoryId: string;
    amount: number;
    period: 'monthly';
}

export interface Notification {
    id: string;
    type: 'transaction_added' | 'transaction_updated' | 'transaction_deleted';
    message: string;
    transactionId?: string;
    createdBy: string;
    createdByName: string;
    createdAt: Date;
    readBy: string[]; // Array of user IDs who have read this notification
}