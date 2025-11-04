// Notification Management

class NotificationManager {
    constructor() {
        this.notificationsEnabled = true;
        this.init();
    }
    
    init() {
        // Request notification permission on page load
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }
    
    // Show browser notification
    showBrowserNotification(sender, message) {
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications");
            return;
        }
        
        if (Notification.permission === "granted") {
            this.createBrowserNotification(sender, message);
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    this.createBrowserNotification(sender, message);
                }
            });
        }
    }
    
    // Create browser notification
    createBrowserNotification(sender, message) {
        const notification = new Notification(`New message from ${sender}`, {
            body: message,
            icon: '/avatar1.png',
            tag: 'chat-message'
        });
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
    }
    
    // Show in-app notification
    showInAppNotification(sender, message) {
        const notificationElement = document.createElement('div');
        notificationElement.className = 'notification';
        notificationElement.innerHTML = `
            <div class="notification-avatar">${sender.charAt(0)}</div>
            <div class="notification-content">
                <h4>New message from ${sender}</h4>
                <p>${message}</p>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        const notificationsContainer = document.getElementById('notifications-container');
        notificationsContainer.appendChild(notificationElement);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.remove();
            }
        }, 5000);
        
        // Close button functionality
        notificationElement.querySelector('.notification-close').addEventListener('click', () => {
            notificationElement.remove();
        });
    }
    
    // Show push notification (browser + in-app)
    showPushNotification(sender, message, shouldShowBrowser = true) {
        if (shouldShowBrowser && (document.hidden || !isElementInViewport(document.getElementById('messages-container')))) {
            this.showBrowserNotification(sender, message);
        }
        
        this.showInAppNotification(sender, message);
    }
    
    // Toggle notifications
    toggleNotifications() {
        this.notificationsEnabled = !this.notificationsEnabled;
        
        // Update UI
        const notificationToggle = document.getElementById('notification-toggle');
        if (notificationToggle) {
            notificationToggle.innerHTML = this.notificationsEnabled ? 
                '<i class="fas fa-bell"></i>' : '<i class="fas fa-bell-slash"></i>';
        }
        
        this.showInAppNotification(
            "Notifications", 
            this.notificationsEnabled ? "Notifications enabled" : "Notifications disabled"
        );
        
        return this.notificationsEnabled;
    }
}

// Create global notification manager instance
const notificationManager = new NotificationManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}