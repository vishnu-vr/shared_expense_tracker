import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, collectionData, onSnapshot } from '@angular/fire/firestore';
import { Category } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private firestore = inject(Firestore);
    private categoriesCollection = collection(this.firestore, 'categories');
    
    categories = signal<Category[]>([]);

    // Default categories (used as fallback and for initial data)
    private defaults: Category[] = [
        // Income
        { id: 'salary', name: 'Salary', icon: 'attach_money', color: '#4CAF50', type: 'income' },
        { id: 'business', name: 'Business', icon: 'business', color: '#8BC34A', type: 'income' },
        { id: 'gifts', name: 'Gifts', icon: 'card_giftcard', color: '#CDDC39', type: 'income' },

        // Expense
        { id: 'baby', name: 'Baby', icon: 'child_friendly', color: '#E91E63', type: 'expense' },
        { id: 'beauty', name: 'Beauty', icon: 'face', color: '#F06292', type: 'expense' },
        { id: 'bills', name: 'Bills', icon: 'receipt', color: '#FF5722', type: 'expense' },
        { id: 'car', name: 'Car', icon: 'directions_car', color: '#2196F3', type: 'expense' },
        { id: 'clothing', name: 'Clothing', icon: 'checkroom', color: '#9C27B0', type: 'expense' },
        { id: 'education', name: 'Education', icon: 'school', color: '#3F51B5', type: 'expense' },
        { id: 'electronics', name: 'Electronics', icon: 'devices', color: '#607D8B', type: 'expense' },
        { id: 'entertainment', name: 'Entertainment', icon: 'movie', color: '#673AB7', type: 'expense' },
        { id: 'food', name: 'Food', icon: 'restaurant', color: '#FF9800', type: 'expense' },
        { id: 'health', name: 'Health', icon: 'favorite', color: '#F44336', type: 'expense' },
        { id: 'home', name: 'Home', icon: 'home', color: '#795548', type: 'expense' },
        { id: 'insurance', name: 'Insurance', icon: 'security', color: '#009688', type: 'expense' },
        { id: 'shopping', name: 'Shopping', icon: 'shopping_cart', color: '#03A9F4', type: 'expense' },
        { id: 'social', name: 'Social', icon: 'people', color: '#E91E63', type: 'expense' },
        { id: 'sport', name: 'Sport', icon: 'sports_soccer', color: '#FFC107', type: 'expense' },
        { id: 'tax', name: 'Tax', icon: 'account_balance', color: '#9E9E9E', type: 'expense' },
        { id: 'telephone', name: 'Telephone', icon: 'phone', color: '#00BCD4', type: 'expense' },
        { id: 'transportation', name: 'Transportation', icon: 'directions_bus', color: '#3F51B5', type: 'expense' },
        { id: 'fun_activities', name: 'Fun Activities', icon: 'celebration', color: '#FFEB3B', type: 'expense' },
        { id: 'grocery', name: 'Grocery', icon: 'local_grocery_store', color: '#8BC34A', type: 'expense' },
    ];

    constructor() {
        this.loadCategories();
    }

    private loadCategories() {
        // Start with defaults
        this.categories.set([...this.defaults]);
        
        // Listen to Firestore for additional/custom categories
        onSnapshot(this.categoriesCollection, (snapshot) => {
            const firestoreCategories = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Category));

            // Merge: Firestore categories override defaults, plus any new ones
            const merged = new Map<string, Category>();
            
            // Add defaults first
            this.defaults.forEach(cat => merged.set(cat.id, cat));
            
            // Override/add with Firestore categories
            firestoreCategories.forEach(cat => merged.set(cat.id, cat));
            
            this.categories.set(Array.from(merged.values()));
        }, (error) => {
            console.error('Error loading categories from Firestore:', error);
            // Keep using defaults on error
        });
    }
}
