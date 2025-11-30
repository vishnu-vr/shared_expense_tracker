import { Injectable, signal } from '@angular/core';
import { Category } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    categories = signal<Category[]>([]);

    constructor() {
        this.loadCategories();
    }

    private loadCategories() {
        const defaults: Omit<Category, 'id'>[] = [
            // Income
            { name: 'Salary', icon: 'attach_money', color: '#4CAF50', type: 'income' },
            { name: 'Business', icon: 'business', color: '#8BC34A', type: 'income' },
            { name: 'Gifts', icon: 'card_giftcard', color: '#CDDC39', type: 'income' },

            // Expense
            { name: 'Baby', icon: 'child_friendly', color: '#E91E63', type: 'expense' },
            { name: 'Beauty', icon: 'face', color: '#F06292', type: 'expense' },
            { name: 'Bills', icon: 'receipt', color: '#FF5722', type: 'expense' },
            { name: 'Car', icon: 'directions_car', color: '#2196F3', type: 'expense' },
            { name: 'Clothing', icon: 'checkroom', color: '#9C27B0', type: 'expense' },
            { name: 'Education', icon: 'school', color: '#3F51B5', type: 'expense' },
            { name: 'Electronics', icon: 'devices', color: '#607D8B', type: 'expense' },
            { name: 'Entertainment', icon: 'movie', color: '#673AB7', type: 'expense' },
            { name: 'Food', icon: 'restaurant', color: '#FF9800', type: 'expense' },
            { name: 'Health', icon: 'favorite', color: '#F44336', type: 'expense' },
            { name: 'Home', icon: 'home', color: '#795548', type: 'expense' },
            { name: 'Insurance', icon: 'security', color: '#009688', type: 'expense' },
            { name: 'Shopping', icon: 'shopping_cart', color: '#03A9F4', type: 'expense' },
            { name: 'Social', icon: 'people', color: '#E91E63', type: 'expense' },
            { name: 'Sport', icon: 'sports_soccer', color: '#FFC107', type: 'expense' },
            { name: 'Tax', icon: 'account_balance', color: '#9E9E9E', type: 'expense' },
            { name: 'Telephone', icon: 'phone', color: '#00BCD4', type: 'expense' },
            { name: 'Transportation', icon: 'directions_bus', color: '#3F51B5', type: 'expense' },
            { name: 'Fun Activities', icon: 'celebration', color: '#FFEB3B', type: 'expense' },
            { name: 'Grocery', icon: 'local_grocery_store', color: '#8BC34A', type: 'expense' },
        ];

        const categoriesWithIds: Category[] = defaults.map(cat => ({
            ...cat,
            id: cat.name.toLowerCase().replace(/ /g, '_')
        }));

        this.categories.set(categoriesWithIds);
    }
}
