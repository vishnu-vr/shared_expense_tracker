import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/models';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.css'
})
export class CategoryFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private categoryService = inject(CategoryService);

  isEdit = signal(false);
  categoryId: string | null = null;

  form = this.fb.group({
    name: ['', Validators.required],
    icon: ['category', Validators.required],
    color: ['#2196F3', Validators.required],
    type: ['expense', Validators.required]
  });

  icons = [
    'category', 'fastfood', 'restaurant', 'directions_car', 'directions_bus',
    'attach_money', 'business', 'card_giftcard', 'child_friendly', 'face',
    'receipt', 'checkroom', 'school', 'devices', 'movie', 'favorite',
    'home', 'security', 'shopping_cart', 'people', 'sports_soccer',
    'account_balance', 'phone', 'celebration', 'local_grocery_store',
    'flight', 'hotel', 'pets', 'work', 'fitness_center'
  ];

  colors = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
    '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
    '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E',
    '#607D8B', '#000000'
  ];

  ngOnInit() {
    this.categoryId = this.route.snapshot.paramMap.get('id');
    if (this.categoryId) {
      this.isEdit.set(true);
      const category = this.categoryService.categories().find(c => c.id === this.categoryId);
      if (category) {
        this.form.patchValue({
          name: category.name,
          icon: category.icon,
          color: category.color,
          type: category.type
        });
      }
    }
  }

  async onSubmit() {
    if (this.form.valid) {
      const val = this.form.value;
      const categoryData = {
        name: val.name!,
        icon: val.icon!,
        color: val.color!,
        type: val.type as 'income' | 'expense'
      };

      if (this.isEdit() && this.categoryId) {
        await this.categoryService.updateCategory({
          ...categoryData,
          id: this.categoryId
        });
      } else {
        await this.categoryService.addCategory(categoryData);
      }
      this.router.navigate(['/categories']);
    }
  }

  async onDelete() {
    if (this.isEdit() && this.categoryId) {
      if (confirm('Are you sure you want to delete this category?')) {
        await this.categoryService.deleteCategory(this.categoryId);
        this.router.navigate(['/categories']);
      }
    }
  }

  onCancel() {
    this.router.navigate(['/categories']);
  }
}
