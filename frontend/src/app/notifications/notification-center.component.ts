import { Component, OnInit } from '@angular/core';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-notification-center',
  templateUrl: './notification-center.component.html',
  styleUrl: './notification-center.component.css',
  standalone: false
})
export class NotificationCenterComponent implements OnInit {
  isPanelOpen: boolean = false;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Toggle dropdown panel visibility
   */
  onTogglePanel(): void {
    this.isPanelOpen = !this.isPanelOpen;
  }

  /**
   * Close dropdown panel
   */
  onClosePanel(): void {
    this.isPanelOpen = false;
  }
}
