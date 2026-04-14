import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Observable } from 'rxjs';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css',
  standalone: false,
  animations: [
    trigger('bellRing', [
      state('ringing', style({
        transform: 'rotate(0deg)'
      })),
      transition('* => ringing', [
        animate('0.5s ease-in-out', style({ transform: 'rotate(25deg) scaleX(-1)' })),
        animate('0.5s ease-in-out', style({ transform: 'rotate(0deg) scaleX(-1)' })),
        animate('0.5s ease-in-out', style({ transform: 'rotate(0deg)' }))
      ])
    ])
  ]
})
export class NotificationBellComponent implements OnInit {
  @Input() showPanel: boolean = false;
  @Output() togglePanel = new EventEmitter<void>();

  unreadCount$: Observable<number>;
  bellAnimationState = '';

  constructor(private notificationService: NotificationService) {
    this.unreadCount$ = this.notificationService.unreadCount$;
  }

  ngOnInit(): void {
    // Trigger animation on new unread notifications
    this.unreadCount$.subscribe(count => {
      if (count > 0) {
        this.bellAnimationState = 'ringing';
        setTimeout(() => {
          this.bellAnimationState = '';
        }, 1500);
      }
    });
  }

  onBellClick(): void {
    this.togglePanel.emit();
    // Mark all as read when opening panel
    if (!this.showPanel) {
      this.notificationService.markAllAsRead();
    }
  }

  onBellKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onBellClick();
    }
  }
}
