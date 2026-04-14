import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import type { Notification, NotificationPayload } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly STORAGE_KEY = 'app_notifications';
  private readonly MAX_NOTIFICATIONS = 50; // Store max 50 notifications

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();

  private currentPageTaskIdSubject = new BehaviorSubject<string | null>(null);
  public currentPageTaskId$: Observable<string | null> = this.currentPageTaskIdSubject.asObservable();

  constructor() {
    this.initializeNotifications();
    this.requestNotificationPermission();
  }

  /**
   * Initialize notifications from localStorage
   */
  private initializeNotifications(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const notifications = JSON.parse(stored).map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt)
        }));
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();
      }
    } catch (error) {
      console.error('Failed to load notifications from storage:', error);
    }
  }

  /**
   * Request permission for desktop notifications
   */
  private requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(err => {
        console.warn('Notification permission denied:', err);
      });
    }
  }

  /**
   * Add a new notification
   */
  public addNotification(payload: NotificationPayload): void {
    const notification: Notification = {
      id: this.generateId(),
      title: payload.title,
      message: payload.message,
      taskId: payload.taskId,
      courseId: payload.courseId,
      read: false,
      createdAt: new Date(),
      icon: payload.icon || 'check_circle'
    };

    const current = this.notificationsSubject.value;
    const updated = [notification, ...current].slice(0, this.MAX_NOTIFICATIONS);

    this.notificationsSubject.next(updated);
    this.updateUnreadCount();
    this.persistNotifications(updated);

    // Show desktop notification if user is not on the relevant page
    this.showDesktopNotification(notification);

    // Play sound if enabled
    this.playNotificationSound();
  }

  /**
   * Mark a specific notification as read
   */
  public markAsRead(notificationId: string): void {
    const updated = this.notificationsSubject.value.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    this.notificationsSubject.next(updated);
    this.updateUnreadCount();
    this.persistNotifications(updated);
  }

  /**
   * Mark all notifications as read
   */
  public markAllAsRead(): void {
    const updated = this.notificationsSubject.value.map(n => ({ ...n, read: true }));
    this.notificationsSubject.next(updated);
    this.updateUnreadCount();
    this.persistNotifications(updated);
  }

  /**
   * Delete a notification
   */
  public deleteNotification(notificationId: string): void {
    const updated = this.notificationsSubject.value.filter(n => n.id !== notificationId);
    this.notificationsSubject.next(updated);
    this.updateUnreadCount();
    this.persistNotifications(updated);
  }

  /**
   * Clear all notifications
   */
  public clearAllNotifications(): void {
    this.notificationsSubject.next([]);
    this.updateUnreadCount();
    this.persistNotifications([]);
  }

  /**
   * Get all notifications
   */
  public getNotifications(): Notification[] {
    return this.notificationsSubject.value;
  }

  /**
   * Get unread count
   */
  public getUnreadCount(): number {
    return this.notificationsSubject.value.filter(n => !n.read).length;
  }

  /**
   * Set current page task ID (to avoid desktop notifications on relevant page)
   */
  public setCurrentPageTaskId(taskId: string | null): void {
    this.currentPageTaskIdSubject.next(taskId);
  }

  /**
   * Update unread count
   */
  private updateUnreadCount(): void {
    const count = this.getUnreadCount();
    this.unreadCountSubject.next(count);
  }

  /**
   * Persist notifications to localStorage
   */
  private persistNotifications(notifications: Notification[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to persist notifications:', error);
    }
  }

  /**
   * Show desktop notification
   */
  private showDesktopNotification(notification: Notification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const currentTaskId = this.currentPageTaskIdSubject.value;

      // Only show if user is not on the relevant page
      if (currentTaskId !== notification.taskId) {
        this.createDesktopNotification(notification);
      }
    }
  }

  /**
   * Create a desktop notification
   */
  private createDesktopNotification(notification: Notification): void {
    try {
      const desktopNotif = new Notification(notification.title, {
        body: notification.message,
        icon: '/assets/logo.png', // Update path to your app logo
        badge: '/assets/badge.png', // Update path to your badge icon
        tag: `notification-${notification.id}`,
        requireInteraction: true // Keeps notification visible
      });

      desktopNotif.onclick = () => {
        // Focus the app and navigate to task
        window.focus();
        if (notification.courseId && Number.isFinite(notification.courseId) && notification.courseId > 0) {
          window.location.href = `/chat?courseId=${notification.courseId}`;
          return;
        }

        const match = notification.taskId?.match(/course-(\d+)/);
        if (match?.[1]) {
          const courseId = Number(match[1]);
          if (Number.isFinite(courseId) && courseId > 0) {
            window.location.href = `/chat?courseId=${courseId}`;
            return;
          }
        }

        window.location.href = `/tasks/${notification.taskId}`;
      };
    } catch (error) {
      console.error('Failed to create desktop notification:', error);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    // Only play if enabled (you could add a setting for this)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // 800 Hz tone
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      // Silently fail if audio context is not available
      // (e.g., in some browsers or blocked contexts)
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
