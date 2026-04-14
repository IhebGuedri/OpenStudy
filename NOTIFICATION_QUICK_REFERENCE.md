# Notification System - Quick Reference

## Common Code Snippets

### 1. Create a Notification (Basic)

```typescript
import { NotificationService } from './services/notification.service';

export class MyComponent {
  constructor(private notifService: NotificationService) {}

  notifyUser() {
    this.notifService.addNotification({
      title: 'Success',
      message: 'Operation completed successfully',
      taskId: 'task-123',
      icon: 'check_circle'
    });
  }
}
```

### 2. Create a Notification with Timestamp

```typescript
this.notifService.addNotification({
  title: 'Task Generated',
  message: `Document processed on ${new Date().toLocaleString('fr-FR')}`,
  taskId: `task-${Date.now()}`,
  icon: 'assignment'
});
```

### 3. Create a Notification from Service

```typescript
// In any service (e.g., api.service.ts)
import { NotificationService } from './notification.service';

@Injectable()
export class ApiService {
  constructor(
    private http: HttpClient,
    private notifService: NotificationService
  ) {}

  processData(data: any): Observable<any> {
    return this.http.post('/api/process', data).pipe(
      tap(response => {
        this.notifService.addNotification({
          title: 'Process Complete',
          message: 'Data has been processed and saved',
          taskId: response.id,
          icon: 'cloud_done'
        });
      })
    );
  }
}
```

### 4. Subscribe to Notifications in Component

```typescript
export class DashboardComponent implements OnInit {
  notifications$: Observable<Notification[]>;
  unreadCount$: Observable<number>;

  constructor(private notifService: NotificationService) {
    this.notifications$ = this.notifService.notifications$;
    this.unreadCount$ = this.notifService.unreadCount$;
  }

  ngOnInit() {
    // Log whenever notifications change
    this.notifications$.subscribe(notifs => {
      console.log('Notifications:', notifs);
    });

    // Log unread count
    this.unreadCount$.subscribe(count => {
      console.log('Unread:', count);
    });
  }
}
```

### 5. Display Notifications in Template

```html
<!-- Show unread count -->
<span *ngIf="(unreadCount$ | async) as count">
  {{ count }} unread notifications
</span>

<!-- List notifications -->
<ul *ngIf="notifications$ | async as notifs">
  <li *ngFor="let notif of notifs">
    <strong>{{ notif.title }}</strong>
    <p>{{ notif.message }}</p>
    <small>{{ notif.createdAt | date: 'short' }}</small>
  </li>
</ul>

<!-- Empty state -->
<p *ngIf="!(notifications$ | async)?.length">No notifications</p>
```

### 6. Mark Notifications as Read

```typescript
export class NotificationListComponent {
  notifications$: Observable<Notification[]>;

  constructor(private notifService: NotificationService) {
    this.notifications$ = this.notifService.notifications$;
  }

  markAsRead(id: string) {
    this.notifService.markAsRead(id);
  }

  markAllRead() {
    this.notifService.markAllAsRead();
  }

  deleteNotification(id: string) {
    this.notifService.deleteNotification(id);
  }

  clearAll() {
    if (confirm('Delete all notifications?')) {
      this.notifService.clearAllNotifications();
    }
  }
}
```

### 7. Navigation from Notification

```typescript
export class NotificationComponent {
  constructor(
    private router: Router,
    private notifService: NotificationService
  ) {}

  onNotificationClick(notification: Notification) {
    // Mark as read
    this.notifService.markAsRead(notification.id);

    // Navigate to task
    this.router.navigate(['/tasks', notification.taskId]);
  }
}
```

### 8. Prevent Desktop Notifications on Current Page

```typescript
export class TaskDetailComponent implements OnInit, OnDestroy {
  taskId: string;

  constructor(
    private route: ActivatedRoute,
    private notifService: NotificationService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.taskId = params['id'];
      // Tell service not to show desktop notifications for this task
      this.notifService.setCurrentPageTaskId(this.taskId);
    });
  }

  ngOnDestroy() {
    // Clear when leaving page
    this.notifService.setCurrentPageTaskId(null);
  }
}
```

### 9. Complex Notification Workflow

```typescript
export class ReportGeneratorComponent {
  constructor(
    private reportService: ReportService,
    private notifService: NotificationService
  ) {}

  generateReport(topic: string) {
    const taskId = `report-${Date.now()}`;

    this.reportService.generateReport(topic).subscribe(
      (report) => {
        // Success notification
        this.notifService.addNotification({
          title: 'Report Generated',
          message: `Your report on "${topic}" is ready`,
          taskId: taskId,
          icon: 'description'
        });
      },
      (error) => {
        // Error notification
        this.notifService.addNotification({
          title: 'Report Failed',
          message: `Failed to generate report: ${error.message}`,
          taskId: taskId,
          icon: 'error'
        });
      }
    );
  }
}
```

### 10. Get Notifications Programmatically

```typescript
export class AnalyticsComponent {
  constructor(private notifService: NotificationService) {}

  analyzeNotifications() {
    // Get all notifications (synchronous)
    const all = this.notifService.getNotifications();
    console.log(`Total: ${all.length}`);

    // Get unread count (synchronous)
    const unread = this.notifService.getUnreadCount();
    console.log(`Unread: ${unread}`);

    // Count by type
    const icons = all.map(n => n.icon);
    console.log('Notification types:', icons);

    // Get recent notifications
    const recent = all.slice(0, 5);
    console.log('Last 5:', recent);
  }
}
```

### 11. Custom Time Formatting

```typescript
// If you want to customize time display
export class CustomNotificationComponent {
  getTimeString(date: Date): string {
    const now = new Date();
    const diffSeconds = (now.getTime() - date.getTime()) / 1000;

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;

    return date.toLocaleDateString();
  }
}
```

### 12. With Reactive Forms

```typescript
export class NotificationSettingsComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private notifService: NotificationService
  ) {
    this.form = this.fb.group({
      enableDesktop: [true],
      enableSound: [true],
      maxNotifications: [50]
    });
  }

  saveSettings() {
    const settings = this.form.value;
    // Save to service or backend
    console.log('Settings saved:', settings);
  }
}
```

### 13. With ngIf/ngFor in Template

```html
<!-- Show if unread -->
<div *ngIf="(unreadCount$ | async) as count" 
     [class.has-notifications]="count > 0">
  <button (click)="markAllRead()">Mark all read</button>
</div>

<!-- Loop with async pipe -->
<div class="notification-list">
  <div *ngFor="let notif of notifications$ | async; 
              let i = index; 
              let last = last"
       [class.unread]="!notif.read"
       [class.last]="last"
       (click)="selectNotification(notif)">
    <mat-icon>{{ notif.icon }}</mat-icon>
    <div class="content">
      <h3>{{ notif.title }}</h3>
      <p>{{ notif.message }}</p>
    </div>
  </div>
</div>
```

### 14. With Error Handling

```typescript
export class SafeNotificationComponent {
  constructor(private notifService: NotificationService) {}

  notifyWithFallback(data: any) {
    try {
      this.notifService.addNotification({
        title: data.title || 'Notification',
        message: data.message || 'A notification has arrived',
        taskId: data.taskId || 'unknown',
        icon: data.icon || 'notifications'
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
      // Fallback: alert user
      alert('Something happened but we could not notify you');
    }
  }
}
```

### 15. Batch Notifications

```typescript
export class BatchProcessor {
  constructor(private notifService: NotificationService) {}

  processBatch(items: any[]) {
    let successful = 0;
    let failed = 0;

    items.forEach((item, index) => {
      try {
        // Process item
        this.processItem(item);
        successful++;
      } catch (error) {
        failed++;
      }
    });

    // Single notification for batch
    this.notifService.addNotification({
      title: 'Batch Processing Complete',
      message: `${successful} succeeded, ${failed} failed`,
      taskId: `batch-${Date.now()}`,
      icon: successful > failed ? 'check_circle' : 'warning'
    });
  }

  private processItem(item: any) {
    // Your processing logic
  }
}
```

## Material Icons Reference

### Success/Completion
```
check_circle        ✓ Checkmark circle
done                ✓ Done/Complete
task_alt            ✓ Task with checkmark
file_download       ⬇ Download complete
cloud_done          ☁ Cloud upload done
```

### Information
```
info                ℹ Information
notifications       🔔 Bell icon
chat_bubble         💬 Comment/Chat
announcement        📢 Announcement
```

### Warning/Error
```
warning             ⚠ Warning
error               ❌ Error
dangerous           ⚡ Dangerous
close               ✕ Close/Failed
```

### Action
```
done_all            ✓ All done
assignment          📋 Task/Assignment
description         📄 Document
edit                ✏ Edit
delete              🗑 Delete
```

### Data/System
```
cloud_sync          ☁ Syncing
autorenew           ↻ Refresh/Reload
schedule            ⏰ Scheduled
timer               ⏱ Timer
```

## Environment Setup

### Required Imports

```typescript
// In your component
import { Observable } from 'rxjs';
import { NotificationService } from './services/notification.service';
import { Notification } from './models/notification.model';
import { Router, ActivatedRoute } from '@angular/router';
```

### Module Setup

```typescript
// In app-module.ts (already done)
import { NotificationCenterComponent } from './notifications/notification-center.component';
import { NotificationBellComponent } from './notifications/notification-bell.component';
import { NotificationDropdownComponent } from './notifications/notification-dropdown.component';

@NgModule({
  declarations: [
    NotificationCenterComponent,
    NotificationBellComponent,
    NotificationDropdownComponent,
    // ... other components
  ],
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    // ... other modules
  ]
})
export class AppModule { }
```

## RxJS Patterns

### Combine Notifications with Other Observables

```typescript
import { combineLatest } from 'rxjs';

export class CombinedComponent {
  data$: Observable<any>;
  notifications$: Observable<any>;
  combined$: Observable<any>;

  constructor(
    private notifService: NotificationService,
    private dataService: DataService
  ) {
    this.notifications$ = this.notifService.notifications$;
    this.data$ = this.dataService.getData();

    // Combine both
    this.combined$ = combineLatest([
      this.notifications$,
      this.data$
    ]);
  }
}
```

### Filter Notifications

```typescript
export class FilteredNotifications {
  constructor(private notifService: NotificationService) {}

  getUnreadOnly() {
    return this.notifService.notifications$.pipe(
      map(notifs => notifs.filter(n => !n.read))
    );
  }

  getRecent(minutes: number = 60) {
    return this.notifService.notifications$.pipe(
      map(notifs => notifs.filter(n => {
        const age = Date.now() - new Date(n.createdAt).getTime();
        return age < minutes * 60 * 1000;
      }))
    );
  }
}
```

## Testing Examples

```typescript
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('should add notification', (done) => {
    service.addNotification({
      title: 'Test',
      message: 'Test message',
      taskId: 'test-1',
      icon: 'info'
    });

    service.notifications$.subscribe(notifs => {
      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toBe('Test');
      done();
    });
  });

  it('should mark as read', (done) => {
    service.addNotification({
      title: 'Test',
      message: 'Test',
      taskId: 'test-1'
    });

    const notif = service.getNotifications()[0];
    service.markAsRead(notif.id);

    service.notifications$.subscribe(notifs => {
      expect(notifs[0].read).toBe(true);
      done();
    });
  });
});
```

---

**Tip**: Copy any of these snippets and adapt them to your use case!
