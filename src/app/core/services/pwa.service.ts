import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class PwaService {
    private deferredPrompt: any;
    showInstallButton = signal(false);

    constructor() {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            this.deferredPrompt = e;
            // Update UI notify the user they can install the PWA
            this.showInstallButton.set(true);
            console.log('PWA Service: beforeinstallprompt event fired');
        });

        window.addEventListener('appinstalled', () => {
            // Hide the app-provided install promotion
            this.showInstallButton.set(false);
            // Clear the deferredPrompt so it can be garbage collected
            this.deferredPrompt = null;
            console.log('PWA Service: App installed');
        });
    }

    async installPwa() {
        if (!this.deferredPrompt) {
            return;
        }
        // Show the install prompt
        this.deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`PWA Service: User response to install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, throw it away
        this.deferredPrompt = null;
        this.showInstallButton.set(false);
    }
}
