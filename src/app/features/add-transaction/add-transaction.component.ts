import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { AuthService } from '../../core/services/auth.service';
import { Transaction } from '../../core/models/models';

@Component({
  selector: 'app-add-transaction',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-transaction.component.html',
  styleUrl: './add-transaction.component.css'
})
export class AddTransactionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private transactionService = inject(TransactionService);
  private authService = inject(AuthService);
  categoryService = inject(CategoryService);

  isEdit = signal(false);
  isOwner = signal(true);
  isSaving = signal(false);
  transactionId: string | null = null;

  form = this.fb.group({
    type: ['expense', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    categoryId: ['', Validators.required],
    date: [new Date().toLocaleDateString('en-CA'), Validators.required],
    time: [new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), Validators.required],
    note: ['']
  });

  ngOnInit() {
    this.transactionId = this.route.snapshot.paramMap.get('id');
    if (this.transactionId) {
      this.isEdit.set(true);
      const transaction = this.transactionService.transactions().find(t => t.id === this.transactionId);

      if (transaction) {
        // Check ownership
        const currentUser = this.authService.currentUser();
        if (currentUser && transaction.userId && transaction.userId !== currentUser.uid) {
          this.isOwner.set(false);
          this.form.disable();
        }

        const transDate = new Date(transaction.date);
        this.form.patchValue({
          type: transaction.type,
          amount: transaction.amount,
          categoryId: transaction.categoryId,
          date: transDate.toLocaleDateString('en-CA'),
          time: transDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          note: transaction.note
        });
      }
    }
  }

  async onSubmit() {
    if (this.form.valid && this.isOwner() && !this.isSaving()) {
      this.isSaving.set(true);
      try {
        const val = this.form.value;
        // Combine date and time
        const dateTime = new Date(`${val.date}T${val.time}`);
        const transactionData = {
          amount: val.amount!,
          type: val.type as 'income' | 'expense',
          categoryId: val.categoryId!,
          date: dateTime,
          note: val.note || '',
          accountId: 'default' // Placeholder
        };

        if (this.isEdit() && this.transactionId) {
          await this.transactionService.updateTransaction({
            ...transactionData,
            id: this.transactionId
          });
        } else {
          await this.transactionService.addTransaction(transactionData);
        }
        this.router.navigate(['/dashboard']);
      } catch (error) {
        console.error('Error saving transaction:', error);
        this.isSaving.set(false);
        alert('Failed to save transaction. Please try again.');
      }
    }
  }

  async onDelete() {
    if (this.isEdit() && this.transactionId && this.isOwner()) {
      if (confirm('Are you sure you want to delete this transaction?')) {
        await this.transactionService.deleteTransaction(this.transactionId);
        this.router.navigate(['/dashboard']);
      }
    }
  }

  onCancel() {
    this.router.navigate(['/dashboard']);
  }
}
