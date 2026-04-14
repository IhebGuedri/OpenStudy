# Notification System Integration Guide

## Quick Start

The notification system has been fully integrated into your Angular application. Here's how to use it:

## 1. Trigger Notifications from AI Services

### From AI Chat Service (Auto-Integrated)

The `AIChatService` already triggers notifications. Just call the methods normally:

```typescript
constructor(private aiChatService: AIChatService) {}

// Generate content - automatically creates a notification
this.aiChatService.generateContent(
  topic: 'Introduction to Machine Learning',
  contentType: 'TEXTE_GENERE',
  context: 'Chapter 1 of AI Course',
  taskId: 'task-ml-001'  // Optional, generated if not provided
).subscribe(
  content => {
    console.log('Content generated:', content);
    // Notification is automatically created!
  }
);

// Send message to AI - automatically creates a notification
this.aiChatService.sendMessage(
  userInput: 'Explain neural networks',
  chapterTitle: 'Advanced AI',
  courseTitle: 'AI Fundamentals',
  existingSections: ['Overview', 'Basics'],
  taskId: 'task-nn-001'  // Optional
).subscribe(
  response => {
    // Notification is automatically created!
  }
);
```

### From Other Services

Inject `NotificationService` in any service:

```typescript
import { NotificationService } from '../services/notification.service';

@Injectable()
export class YourService {
  constructor(private notificationService: NotificationService) {}

  yourMethod() {
    // Do something...
    
    // Then create a notification
    this.notificationService.addNotification({
      title: 'Operation Complete',
      message: 'Your task has been processed successfully',
      taskId: 'task-xyz-789',
      icon: 'check_circle'  // Material icon name
    });
  }
}
```

## 2. Using Notifications in Components

### In Component Class

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from '../services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-my-component',
  templateUrl: './my-component.html'
})
export class MyComponent implements OnInit, OnDestroy {
  notifications$: Observable<Notification[]>;
  unreadCount$: Observable<number>;

  constructor(private notificationService: NotificationService) {
    this.notifications$ = this.notificationService.notifications$;
    this.unreadCount$ = this.notificationService.unreadCount$;
  }

  ngOnInit() {
    // Set current page context to prevent desktop notifications
    this.notificationService.setCurrentPageTaskId('task-123');
  }

  ngOnDestroy() {
    // Clean up
    this.notificationService.setCurrentPageTaskId(null);
  }

  deleteNotification(id: string) {
    this.notificationService.deleteNotification(id);
  }

  markAsRead(id: string) {
    this.notificationService.markAsRead(id);
  }
}
```

### In Component Template

```html
<!-- Get unread count -->
<span *ngIf="(unreadCount$ | async) as count" class="unread-badge">
  {{ count }} unread
</span>

<!-- List all notifications -->
<div *ngFor="let notif of notifications$ | async" class="notification-item">
  <h3>{{ notif.title }}</h3>
  <p>{{ notif.message }}</p>
  <small>{{ notif.createdAt | date: 'short' }}</small>
  <button (click)="deleteNotification(notif.id)">Delete</button>
</div>
```

## 3. Icons for Notifications

Use any Material icon name. Common ones:

```typescript
// Success/Completion
'check_circle'      // Green checkmark circle
'done'              // Checkmark
'file_download'     // File downloaded

// Information
'info'              // Information icon
'notifications'     // Bell icon
'chat_bubble'       // Chat message

// Warnings
'warning'           // Warning triangle
'error'             // Error icon

// Actions
'task_alt'          // Task with checkmark
'assignment'        // Assignment
'description'       // Document
'build'             // Build/Configuration

// AI/Automation
'smart_toy'         // Robot
'psychology'        // Brain icon
'flash_on'          // Lightning bolt

// Custom usage
generateContent(topic, type, context, `task-${topic.toLowerCase()}`);
```

## 4. Navigate to Task Detail

When a notification is clicked, the user is navigated to `/tasks/{taskId}`.

Customize the task detail page in:
```
src/app/pages/tasks/task-detail.component.ts
```

Update the `loadTaskContent()` method to fetch your actual task data:

```typescript
private loadTaskContent(): void {
  this.isLoading = true;
  
  // Replace with your actual API call
  this.taskService.getTask(this.taskId).subscribe(
    task => {
      this.taskContent = task.content;
      this.isLoading = false;
    },
    error => {
      console.error('Failed to load task:', error);
      this.isLoading = false;
    }
  );
}
```

## 5. Real-World Example: Task Generation Workflow

```typescript
// ============ In AI Chat Component ============
import { Component } from '@angular/core';
import { AIChatService } from '../services/ai-chat.service';

@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.component.html'
})
export class AIChatComponent {
  taskId: string = '';

  constructor(private aiChatService: AIChatService) {}

  generateTask() {
    this.taskId = `task-${Date.now()}`;

    this.aiChatService.generateContent(
      topic: 'Data Structures Fundamentals',
      contentType: 'TEXTE_GENERE',
      context: 'Chapter 2: Arrays and Lists',
      taskId: this.taskId
    ).subscribe(
      content => {
        console.log('Task generated and notification created');
        // User will see:
        // 1. Bell icon badge increases
        // 2. Desktop notification (if on different page)
        // 3. Can click notification to view task
      },
      error => console.error('Generation failed:', error)
    );
  }
}
```

## 6. Desktop Notifications

Desktop notifications are **automatic** and require no configuration:

### What Triggers Desktop Notifications?

- ✅ New notification created
- ✅ User is NOT on the relevant task page
- ✅ Browser notification permission is granted

### What Happens on Click?

1. Application window comes to focus
2. User navigates to `/tasks/{taskId}`
3. Task detail page loads
4. Notification disappears from desktop

### Getting Permission

Permission is requested automatically on service initialization. Users see:

```
"This site wants to show notifications"
[Allow] [Block]
```

## 7. Customizing Notification Text (French)

The system is pre-configured for French. Examples in code:

```typescript
// In notification-dropdown.component.ts
getTimeAgo(date: Date): string {
  return 'Il y a 5 min';      // "5 minutes ago"
  return 'À l\'instant';      // "Just now"
  return 'Il y a 2h';         // "2 hours ago"
  return 'Il y a 1j';         // "1 day ago"
}

// In task-detail.component.html
<button mat-raised-button color="primary">
  <mat-icon>edit</mat-icon>
  Modifier                     // "Edit"
</button>
```

To change language, update these methods and strings.

## 8. Advanced: Custom Notification Service Usage

```typescript
// Get current notifications (synchronously)
const all = this.notificationService.getNotifications();
const unreadCount = this.notificationService.getUnreadCount();

// Subscribe to changes
this.notificationService.notifications$.subscribe(notifications => {
  // React to notification changes
  console.log(`Now have ${notifications.length} notifications`);
});

// Mark operations
this.notificationService.markAllAsRead();
this.notificationService.markAsRead(notificationId);
this.notificationService.deleteNotification(notificationId);
this.notificationService.clearAllNotifications();

// Set context to prevent desktop notifications on current page
this.notificationService.setCurrentPageTaskId('task-123');
```

## 9. Style Customization

### Change Bell Position

File: `notification-center.component.css`

```css
.notification-center {
  bottom: 20px;      /* Distance from bottom */
  left: 20px;        /* Distance from left */
  /* Or use: right: 20px; for right side */
}
```

### Change Colors

Files: `notification-bell.component.css` and `notification-dropdown.component.css`

```css
/* Red badge */
.badge {
  background-color: #f44336;  /* Change to any color */
}

/* Custom unread highlight */
.notification-item.unread {
  background-color: #e3f2fd;  /* Light blue */
}
```

### Change Animations

File: `notification-bell.component.ts`

```typescript
trigger('bellRing', [
  // Modify animation keyframes here
  state('ringing', style({
    transform: 'rotate(0deg)'
  })),
  transition('* => ringing', [
    // Change animation duration and effects
    animate('0.5s ease-in-out', style({ transform: 'rotate(25deg)' }))
  ])
])
```

## 10. Debugging

### View Stored Notifications

```javascript
// In browser console
JSON.parse(localStorage.getItem('app_notifications'))
```

### Check Notification Permission

```javascript
// In browser console
console.log(Notification.permission);  // 'granted', 'denied', 'default'
```

### Monitor Notifications

```typescript
// In a component or service
import { NotificationService } from '../services/notification.service';

constructor(private notificationService: NotificationService) {
  this.notificationService.notifications$.subscribe(notifs => {
    console.log('Notifications updated:', notifs);
  });

  this.notificationService.unreadCount$.subscribe(count => {
    console.log('Unread count:', count);
  });
}
```

## 11. CommonMistakes to Avoid

❌ **Don't create duplicate notifications**
```typescript
// BAD - Will create 2 notifications
this.aiChatService.generateContent(...);
this.notificationService.addNotification(...);

// GOOD - Let the service handle it
this.aiChatService.generateContent(...);
```

❌ **Don't forget to set current page context**
```typescript
// BAD - Desktop notifications will appear even when on the page
ngOnInit() {
  // Missing: this.notificationService.setCurrentPageTaskId(taskId);
}

// GOOD
ngOnInit() {
  this.notificationService.setCurrentPageTaskId(this.taskId);
}
```

❌ **Don't forget to clear context on destroy**
```typescript
// BAD - Stale context might prevent desktop notifications elsewhere
ngOnDestroy() {
  // Missing cleanup
}

// GOOD
ngOnDestroy() {
  this.notificationService.setCurrentPageTaskId(null);
}
```

## 12. Testing Notifications

### Test Notification Creation

1. Open app in browser
2. Go to a page that generates notifications (or manually call a service)
3. Check that:
   - ✅ Bell icon appears in bottom-left
   - ✅ Badge shows unread count
   - ✅ Sound plays (if enabled)

### Test Dropdown

1. Click the bell icon
2. Check that:
   - ✅ Dropdown opens with animation
   - ✅ Notifications display in reverse chronological order
   - ✅ Each item shows: icon, title, message, time

### Test Navigation

1. Click a notification in dropdown
2. Check that:
   - ✅ You navigate to `/tasks/{taskId}`
   - ✅ Notification is marked as read
   - ✅ Badge count decreases

### Test Desktop Notifications

1. Open app in a separate window/tab
2. Request notification permission if asked
3. Go to a different page
4. Trigger a notification
5. Check that:
   - ✅ Desktop notification appears
   - ✅ Clicking it opens the app and navigates to task

### Test localStorage

1. Open Developer Tools → Application → Local Storage
2. Look for key: `app_notifications`
3. Generate a notification
4. Verify it appears in localStorage
5. Refresh page
6. Verify notification is still there

## Next Steps

1. **Customize icons** in your services to match your app theme
2. **Update task-detail component** to show actual task content from your API
3. **Add notification preferences** UI for users to control:
   - Enable/disable desktop notifications
   - Enable/disable sound
   - Notification categories to subscribe to
4. **Integrate with your backend** for persistent notification storage across devices
5. **Add push notifications** using Service Workers for better visibility

## Support & Issues

- 📝 Check `notifications/README.md` for detailed documentation
- 🔍 Check browser console for errors
- 💾 Check localStorage contents in DevTools
- 🔔 Verify browser notification permissions

Enjoy your new notification system! 🎉
