import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, query, orderBy, onSnapshot, arrayUnion, Timestamp, limit } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Notification } from '../models/models';
import { Subscription } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class NotificationService implements OnDestroy {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private notificationsCollection = collection(this.firestore, 'notifications');
    private unsubscribe: (() => void) | null = null;
    private seenNotificationIds = new Set<string>();
    private isInitialLoad = true;

    // Signals
    notifications = signal<Notification[]>([]);
    showDropdown = signal(false);
    pushPermission = signal<NotificationPermission>('default');

    // Computed: unread notifications for current user
    unreadNotifications = computed(() => {
        const user = this.authService.currentUser();
        if (!user) return [];
        
        return this.notifications().filter(n => 
            !n.readBy.includes(user.uid) && n.createdBy !== user.uid
        );
    });

    unreadCount = computed(() => this.unreadNotifications().length);

    // All notifications visible to current user (not created by them)
    visibleNotifications = computed(() => {
        const user = this.authService.currentUser();
        if (!user) return [];
        
        return this.notifications().filter(n => n.createdBy !== user.uid);
    });

    constructor() {
        this.initPushNotifications();
        this.loadNotifications();
    }

    // Initialize push notification permission
    private async initPushNotifications() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return;
        }

        this.pushPermission.set(Notification.permission);
        
        // If permission not yet requested, we'll ask when user interacts
        if (Notification.permission === 'default') {
            // Permission will be requested when user enables notifications
        }
    }

    // Request permission for push notifications
    async requestPushPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            return false;
        }

        const permission = await Notification.requestPermission();
        this.pushPermission.set(permission);
        return permission === 'granted';
    }

    // Show a native device notification
    private showPushNotification(notification: Notification) {
        if (this.pushPermission() !== 'granted') return;
        if (document.hasFocus()) return; // Don't show if app is focused

        const options: NotificationOptions & { vibrate?: number[] } = {
            body: notification.message,
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-72x72.png',
            tag: notification.id, // Prevents duplicate notifications
            vibrate: [200, 100, 200], // Vibration pattern for mobile devices
            data: {
                transactionId: notification.transactionId,
                url: '/dashboard'
            }
        };

        const pushNotif = new window.Notification('Expense Tracker', options);
        
        pushNotif.onclick = () => {
            window.focus();
            pushNotif.close();
        };
    }

    ngOnDestroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    private loadNotifications() {
        this.authService.user$.subscribe(user => {
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
            }

            // Reset state when user changes
            this.seenNotificationIds.clear();
            this.isInitialLoad = true;

            if (user) {
                // Fetch recent notifications (last 50, ordered by date)
                const q = query(
                    this.notificationsCollection, 
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                
                this.unsubscribe = onSnapshot(q, (snapshot) => {
                    const notifications = snapshot.docs.map(docSnap => {
                        const data = docSnap.data();
                        return {
                            id: docSnap.id,
                            ...data,
                            createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
                            readBy: data['readBy'] || []
                        } as Notification;
                    });

                    // Detect new notifications (not from current user)
                    if (!this.isInitialLoad) {
                        notifications.forEach(n => {
                            if (!this.seenNotificationIds.has(n.id) && n.createdBy !== user.uid) {
                                // This is a new notification from another user
                                this.showPushNotification(n);
                            }
                        });
                    }

                    // Update seen IDs
                    notifications.forEach(n => this.seenNotificationIds.add(n.id));
                    this.isInitialLoad = false;

                    this.notifications.set(notifications);
                }, (error) => {
                    console.error('Error loading notifications:', error);
                });
            } else {
                this.notifications.set([]);
            }
        });
    }

    async createNotification(
        type: Notification['type'],
        message: string,
        transactionId?: string
    ) {
        const user = this.authService.currentUser();
        if (!user) throw new Error('User not authenticated');

        const notification = {
            type,
            message,
            transactionId: transactionId || null,
            createdBy: user.uid,
            createdByName: user.displayName || user.email || 'Unknown User',
            createdAt: Timestamp.now(),
            readBy: []
        };

        await addDoc(this.notificationsCollection, notification);
    }

    async markAsRead(notificationId: string) {
        const user = this.authService.currentUser();
        if (!user) return;

        const docRef = doc(this.firestore, 'notifications', notificationId);
        await updateDoc(docRef, {
            readBy: arrayUnion(user.uid)
        });
    }

    async markAllAsRead() {
        const user = this.authService.currentUser();
        if (!user) return;

        const unread = this.unreadNotifications();
        const promises = unread.map(n => {
            const docRef = doc(this.firestore, 'notifications', n.id);
            return updateDoc(docRef, {
                readBy: arrayUnion(user.uid)
            });
        });

        await Promise.all(promises);
    }

    toggleDropdown() {
        this.showDropdown.update(v => !v);
    }

    closeDropdown() {
        this.showDropdown.set(false);
    }

    // Helper to format time ago
    getTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
}

