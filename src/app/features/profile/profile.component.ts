import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './profile.component.html',
    styles: []
})
export class ProfileComponent {
    authService = inject(AuthService);
    user = this.authService.currentUser;

    logout() {
        this.authService.logout().subscribe();
    }
}
