import { Component, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-notification-bell',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './notification-bell.component.html',
    styleUrl: './notification-bell.component.css'
})
export class NotificationBellComponent {
    notificationService = inject(NotificationService);
    private authService = inject(AuthService);
    private elementRef = inject(ElementRef);

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        // Close dropdown if clicked outside
        if (!this.elementRef.nativeElement.contains(event.target)) {
            this.notificationService.closeDropdown();
        }
    }

    toggleDropdown(event: Event) {
        event.stopPropagation();
        this.notificationService.toggleDropdown();
    }

    markAsRead(notificationId: string, event: Event) {
        event.stopPropagation();
        this.notificationService.markAsRead(notificationId);
    }

    markAllAsRead(event: Event) {
        event.stopPropagation();
        this.notificationService.markAllAsRead();
    }

    isRead(notification: any): boolean {
        const user = this.authService.currentUser();
        if (!user) return false;
        return notification.readBy?.includes(user.uid);
    }

    getNotificationIcon(type: string): string {
        switch (type) {
            case 'transaction_added':
                return 'add_circle';
            case 'transaction_updated':
                return 'edit';
            case 'transaction_deleted':
                return 'delete';
            default:
                return 'notifications';
        }
    }

    getNotificationColor(type: string): string {
        switch (type) {
            case 'transaction_added':
                return 'text-green-500';
            case 'transaction_updated':
                return 'text-blue-500';
            case 'transaction_deleted':
                return 'text-red-500';
            default:
                return 'text-gray-500';
        }
    }
}

