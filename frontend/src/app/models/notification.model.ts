/**
 * Notification Model
 * Represents a single notification in the system
 */
export interface Notification {
  id: string;
  title: string;
  message: string;
  taskId: string;
  courseId?: number;
  read: boolean;
  createdAt: Date;
  icon?: string; // Material icon name
}

/**
 * Notification creation request
 */
export interface NotificationPayload {
  title: string;
  message: string;
  taskId: string;
  courseId?: number;
  icon?: string;
}
