import { Injectable, signal, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { Category } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private storage = inject(StorageService);

    categories = signal<Category[]>([]);

    constructor() {
        this.loadCategories();
    }

    async loadCategories() {
        const data = await this.storage.getAllCategories();
        // Always check and seed missing defaults
        await this.seedDefaultCategories(data as Category[]);

        // Reload to get the newly added ones if any
        const updatedData = await this.storage.getAllCategories();
        this.categories.set(updatedData as Category[]);
    }

    async addCategory(category: Omit<Category, 'id'>) {
        const newCategory: Category = {
            ...category,
            id: crypto.randomUUID()
        };
        await this.storage.addCategory(newCategory as any);
        this.categories.update(c => [...c, newCategory]);
    }

    async updateCategory(category: Category) {
        await this.storage.addCategory(category); // put overwrites
        this.categories.update(c => c.map(cat => cat.id === category.id ? category : cat));
    }

    async deleteCategory(id: string) {
        // TODO: Implement delete in storage service properly
        this.categories.update(c => c.filter(cat => cat.id !== id));
    }

    private async seedDefaultCategories(existingCategories: Category[] = []) {
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

        for (const cat of defaults) {
            const exists = existingCategories.some(c => c.name === cat.name && c.type === cat.type);
            if (!exists) {
                await this.addCategory(cat);
            }
        }
    }
}
