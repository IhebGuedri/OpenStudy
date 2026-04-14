import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Courstitre } from '../chat.models';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-sidebar',
  standalone: false,
  templateUrl: './chat-sidebar.component.html',
  styleUrl: './chat-sidebar.component.css',
})
export class ChatSidebarComponent {
  @Input() listeCours: Courstitre[] = [];
  @Input() activeIndex = -1;
  @Input() isLoading = false;
  @Output() selectCours = new EventEmitter<number>();
  @Output() newConversation = new EventEmitter<void>();
  @Output() deleteCourse = new EventEmitter<number>();

  constructor(public authService: AuthService, private router: Router) {}


  onSelect(index: number): void {
    this.selectCours.emit(index);
  }

  onNew(): void {
    this.newConversation.emit();
  }

  onDelete(courseId: number, event: Event): void {
    event.stopPropagation();
    this.deleteCourse.emit(courseId);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
