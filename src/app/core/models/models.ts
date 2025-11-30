export type TransactionType = 'income' | 'expense';

export interface Transaction {
    id: string;
    amount: number;
    categoryId: string;
    accountId: string;
    date: Date;
    note?: string;
    type: TransactionType;
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
