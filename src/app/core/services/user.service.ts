import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';

export interface AppUser {
    id: string;       // Firebase Auth UID
    name: string;     // Display name
    docId?: string;   // Firestore document ID
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private firestore = inject(Firestore);
    private usersCollection = collection(this.firestore, 'users');
    
    users = signal<AppUser[]>([]);
    private userMap = new Map<string, AppUser>();

    constructor() {
        this.loadUsers();
    }

    private loadUsers() {
        onSnapshot(this.usersCollection, (snapshot) => {
            const users = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    docId: doc.id,
                    id: data['id'] as string,
                    name: data['name'] as string
                } as AppUser;
            });
            
            this.users.set(users);
            
            // Build lookup map by user ID
            this.userMap.clear();
            users.forEach(user => {
                debugger
                if (user.id) {
                    this.userMap.set(user.id, user);
                }
            });
        }, (error) => {
            console.error('Error loading users:', error);
        });
    }

    // Get user by Firebase Auth UID
    getUserById(userId: string): AppUser | undefined {
        return this.userMap.get(userId);
    }

    // Get user name by ID, with fallback
    getUserName(userId: string): string {
        const user = this.userMap.get(userId);
        debugger
        return user?.name || this.formatUserId(userId);
    }

    // Format user ID as fallback (truncate long IDs)
    private formatUserId(userId: string): string {
        if (userId.length > 12) {
            return userId.substring(0, 6) + '...' + userId.substring(userId.length - 4);
        }
        return userId;
    }
}

