# Notification System Documentation

## Overview

A complete, production-ready notification system for Angular applications that alerts users when AI agents finish generating tasks. The system includes:

- **Notification Bell** in the bottom-left corner with badge counter
- **Dropdown Panel** displaying all notifications (latest first)
- **Desktop Notifications** API integration
- **State Management** with localStorage persistence
- **Animations** and sound notifications
- **Accessibility** support (ARIA labels, keyboard navigation)
- **Responsive Design** for mobile and desktop

## Architecture

### Components

```
notifications/
├── notification-center.component.ts      # Main container component
├── notification-bell.component.ts       # Bell icon with badge
├── notification-dropdown.component.ts   # Dropdown panel with notifications
├── notification-bell.component.html
├── notification-dropdown.component.html
├── notification-center.component.html
├── notification-bell.component.css
├── notification-dropdown.component.css
└── notification-center.component.css
```

### Services

- **NotificationService** (`services/notification.service.ts`)
  - Manages notification state
  - Handles localStorage persistence
  - Triggers desktop notifications
  - Provides Observables for reactive updates
  - Emits sound notifications

### Models

- **Notification** (`models/notification.model.ts`)
  - Interface for notification structure
  - `id`: Unique identifier
  - `title`: Notification title
  - `message`: Description
  - `taskId`: Associated task ID
  - `read`: Read status
  - `createdAt`: Timestamp
  - `icon`: Material icon name

## Integration

### 1. Add Notification Center to App Template

The notification center is already added to [app.html](./app.html):

```html
<!-- Bottom-left corner -->
<app-notification-center></app-notification-center>
```

### 2. Inject NotificationService in Your Services

Example: AI Chat Service

```typescript
import { NotificationService } from './notification.service';

export class AIChatService {
  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  generateContent(topic: string, contentType: string): Observable<string> {
    return this.http.post(url, request).pipe(
      tap((response) => {
        // Create notification when content is generated
        this.notificationService.addNotification({
          title: 'Tâche générée',
          message: `Contenu généré pour "${topic}"`,
          taskId: `task_${Date.now()}`,
          icon: 'check_circle'
        });
      })
    );
  }
}
```

## Usage Examples

### Add a Notification

```typescript
constructor(private notificationService: NotificationService) {}

// Create a notification
this.notificationService.addNotification({
  title: 'Task Completed',
  message: 'Your document has been generated successfully',
  taskId: 'doc-123456',
  icon: 'check_circle'
});
```

### Subscribe to Notifications

```typescript
// Get all notifications
this.notificationService.notifications$.subscribe(notifications => {
  console.log('Notifications updated:', notifications);
});

// Get unread count
this.notificationService.unreadCount$.subscribe(count => {
  console.log('Unread count:', count);
});
```

### Mark as Read

```typescript
// Mark specific notification as read
this.notificationService.markAsRead('notification-id');

// Mark all as read
this.notificationService.markAllAsRead();
```

### Delete Notifications

```typescript
// Delete specific notification
this.notificationService.deleteNotification('notification-id');

// Clear all notifications
this.notificationService.clearAllNotifications();
```

### Set Current Page Context

Prevent desktop notifications when user is already on the relevant page:

```typescript
ngOnInit() {
  // When navigating to task detail page
  this.notificationService.setCurrentPageTaskId('task-123');
}

ngOnDestroy() {
  // When leaving the page
  this.notificationService.setCurrentPageTaskId(null);
}
```

## Features

### 1. Notification Bell

- **Location**: Bottom-left corner (fixed position)
- **Badge Counter**: Shows unread notification count (99+ for more)
- **Animation**: Bell rings when new notifications arrive
- **Accessibility**: 
  - ARIA labels and expanded state
  - Keyboard navigation (Enter/Space to open)
  - Focus visible outline

### 2. Dropdown Panel

- **Sorted**: Latest notifications first
- **Clickable Items**: Each notification is clickable
- **Delete Button**: Individual notification deletion
- **Clear All**: Remove all notifications at once
- **Time Display**: Shows "À l'instant", "Il y a 5 min", "Il y a 2h", etc.
- **Empty State**: Message when no notifications exist
- **Styling**: Unread notifications have blue left border and highlight

### 3. Desktop Notifications

- **Automatic Permission Request**: Asks user on first visit
- **Triggers**: Only when user is NOT on the relevant page
- **Click Handler**: Focuses app and navigates to task
- **Requirements**: 
  - Browser must support Notifications API
  - User must grant permission
  - HTTPS recommended (required in production)

### 4. State Management

All notifications are stored in **localStorage** with the key `app_notifications`.

**Structure**:
```typescript
{
  id: 'notif-1681234567890-abc123defgh',
  title: 'Task Generated',
  message: 'Content generated for "Introduction to AI"',
  taskId: 'task_1681234567890',
  read: false,
  createdAt: '2024-04-14T10:30:00.000Z',
  icon: 'check_circle'
}
```

**Persistence**: Automatic, no configuration needed

**Max Stored**: 50 notifications (oldest deleted when limit exceeded)

### 5. Sound Notification

- **Automatic**: Plays a 800Hz tone when new notification arrives
- **Duration**: 500ms
- **Silent Failure**: No error if Audio Context unavailable
- **Control**: Can be disabled by commenting out `playNotificationSound()` call in `addNotification()`

### 6. Navigation

When user clicks a notification:
1. Notification is marked as read
2. User navigates to `/tasks/{taskId}`
3. TaskDetailComponent receives the taskId via route params
4. Desktop notification (if any) won't show again for this task

## Customization

### Change Bell Position

Edit `notification-center.component.css`:

```css
.notification-center {
  position: fixed;
  bottom: 20px;  /* Change vertical position */
  left: 20px;    /* Change: left/right */
  right: auto;   /* Position from right instead */
}
```

### Change Colors

Edit component CSS files:

```css
/* Bell button hover */
.bell-button:hover {
  background-color: #your-color;
}

/* Badge background */
.badge {
  background-color: #your-color;
}

/* Unread indicator */
.notification-item.unread {
  background-color: #your-color;
}
```

### Change Icons

Replace in components:

```html
<!-- Bell icon -->
<mat-icon>notifications</mat-icon>
<!-- Change to: notifications_active, notification_important, etc. -->

<!-- Notification item icons -->
<mat-icon>{{ notification.icon }}</mat-icon>
```

### Customize Time Format

Edit `notification-dropdown.component.ts` `getTimeAgo()` method:

```typescript
getTimeAgo(date: Date): string {
  // Modify the logic here for different time formatting
}
```

### Disable Features

**Disable Sound**:
```typescript
// In notification.service.ts, comment out:
// this.playNotificationSound();
```

**Disable Desktop Notifications**:
```typescript
// In notification.service.ts, comment out:
// this.showDesktopNotification(notification);
```

**Disable localStorage Persistence**:
```typescript
// In notification.service.ts, comment out:
// this.persistNotifications(updated);
```

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Notifications | ✅ | ✅ | ✅ | ✅ |
| Desktop API | ✅ | ✅ | ✅ | ✅ |
| localStorage | ✅ | ✅ | ✅ | ✅ |
| Audio Context | ✅ | ✅ | ✅ | ✅ |
| Animations | ✅ | ✅ | ✅ | ✅ |

**Note**: Desktop notifications require HTTPS in production.

## Accessibility

- ✅ ARIA labels on all interactive elements
- ✅ Keyboard navigation (Tab, Enter, Space)
- ✅ Focus visible indicators
- ✅ Semantic HTML (button, role="button")
- ✅ Color contrast WCAG AA compliant
- ✅ Screen reader friendly

## Performance Considerations

1. **Max Notifications**: Limited to 50 to prevent memory issues
2. **Observables**: Uses RxJS for efficient updates only on changes
3. **DOM Updates**: Angular Change Detection optimized
4. **localStorage**: Automatic cleanup of old notifications
5. **Sound**: Non-blocking, fails silently if unavailable

## Troubleshooting

### Desktop Notifications Not Showing

1. Check browser permission settings
2. Verify HTTPS in production (required)
3. Check console for errors
4. Ensure notification permission is "granted"

```typescript
// Check permission status
console.log(Notification.permission); // 'granted', 'denied', or 'default'
```

### Notifications Not Persisting

1. Check if localStorage is available
2. Verify localStorage is not full
3. Check browser privacy settings
4. Look for exceptions in console

### Sound Not Playing

1. Check browser audio permissions
2. Verify AudioContext is not blocked
3. Some browsers require user interaction before audio

## Testing

```typescript
// Test notification creation
this.notificationService.addNotification({
  title: 'Test Notification',
  message: 'This is a test',
  taskId: 'test-123',
  icon: 'info'
});

// Test mark as read
const notif = this.notificationService.getNotifications()[0];
this.notificationService.markAsRead(notif.id);

// Test desktop notification
// Should appear only if not on /tasks/test-123 page

// Test localStorage
const stored = localStorage.getItem('app_notifications');
console.log(JSON.parse(stored)); // View stored notifications
```

## Future Enhancements

- [ ] Notification categories/filtering
- [ ] Snooze notifications
- [ ] Custom notification sounds
- [ ] Notification history/archive
- [ ] Backend API integration for persistent storage
- [ ] Push notifications (Service Worker)
- [ ] Email notifications
- [ ] Notification preferences/settings UI
- [ ] Notification grouping
- [ ] Real-time updates via WebSocket

## Files Created/Modified

### New Files
- `services/notification.service.ts`
- `models/notification.model.ts`
- `notifications/notification-center.component.ts`
- `notifications/notification-bell.component.ts`
- `notifications/notification-dropdown.component.ts`
- `notifications/*.html` (templates)
- `notifications/*.css` (styles)
- `pages/tasks/task-detail.component.ts`
- `pages/tasks/task-detail.component.html`
- `pages/tasks/task-detail.component.css`

### Modified Files
- `app-module.ts` - Added components and imports
- `app.html` - Added notification center component
- `app-routing-module.ts` - Added `/tasks/:id` route
- `services/ai-chat.service.ts` - Added notification triggers

## Support

For issues or questions about the notification system, check:
1. Browser console for errors
2. Network tab for API issues
3. Application tab for localStorage contents
4. Notifications permission in browser settings
