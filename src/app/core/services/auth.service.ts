import { Injectable, inject, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user, User, UserCredential, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, from, of, tap, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth = inject(Auth);
    private router = inject(Router);

    // Expose user state as a signal
    user$ = user(this.auth);
    currentUser = toSignal(this.user$);

    constructor() { }

    login(email: string, password: string): Observable<UserCredential | null> {
        return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
            tap(() => this.router.navigate(['/dashboard'])),
            catchError(error => {
                console.error('Login failed', error);
                throw error;
            })
        );
    }

    loginWithGoogle(): Observable<UserCredential | null> {
        const provider = new GoogleAuthProvider();
        return from(signInWithPopup(this.auth, provider)).pipe(
            tap(() => this.router.navigate(['/dashboard'])),
            catchError(error => {
                console.error('Login failed', error);
                return of(null);
            })
        );
    }

    logout() {
        return from(signOut(this.auth)).pipe(
            tap(() => this.router.navigate(['/login']))
        );
    }
}
