import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import type { Notification } from '../models/notification.model';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-notification-dropdown',
  templateUrl: './notification-dropdown.component.html',
  styleUrl: './notification-dropdown.component.css',
  standalone: false
})
export class NotificationDropdownComponent implements OnInit {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();

  notifications$: Observable<Notification[]>;

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {
    this.notifications$ = this.notificationService.notifications$;
  }

  ngOnInit(): void {
    // Empty for now
  }

  /**
   * Handle notification click - navigate to task
   */
  onNotificationClick(notification: Notification): void {
    this.notificationService.markAsRead(notification.id);
    const courseId = this.extractCourseId(notification);
    const navigation = courseId > 0
      ? this.router.navigate(['/chat'], { queryParams: { courseId } })
      : this.router.navigate(['/tasks', notification.taskId]);

    navigation.then(() => {
      this.close.emit();
    });
  }

  private extractCourseId(notification: Notification): number {
    if (notification.courseId && Number.isFinite(notification.courseId) && notification.courseId > 0) {
      return notification.courseId;
    }

    const taskId = notification.taskId;
    if (!taskId) {
      return -1;
    }

    const match = taskId.match(/course-(\d+)/);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : -1;
    }

    return -1;
  }

  /**
   * Delete a notification
   */
  onDeleteNotification(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(notification.id);
  }

  /**
   * Clear all notifications
   */
  onClearAll(): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes les notifications ?')) {
      this.notificationService.clearAllNotifications();
    }
  }

  /**
   * Format the time difference
   */
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return new Date(date).toLocaleDateString('fr-FR');
  }

  /**
   * Close dropdown on outside click
   */
  onBackdropClick(): void {
    this.close.emit();
  }
}
