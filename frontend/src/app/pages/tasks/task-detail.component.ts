import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-task-detail',
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.css',
  standalone: false
})
export class TaskDetailComponent implements OnInit, OnDestroy {
  taskId: string = '';
  taskContent: string = '';
  isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Get taskId from route parameters
    this.route.params.subscribe(params => {
      this.taskId = params['id'];

      // Set current task ID to prevent desktop notifications for this page
      this.notificationService.setCurrentPageTaskId(this.taskId);

      // Load task content
      this.loadTaskContent();
    });
  }

  ngOnDestroy(): void {
    // Clear current task ID when leaving the page
    this.notificationService.setCurrentPageTaskId(null);
  }

  /**
   * Load task content from backend or cache
   * This is a placeholder - adapt to your actual API
   */
  private loadTaskContent(): void {
    this.isLoading = true;

    // TODO: Replace with actual API call to fetch task details
    // For now, we'll just show a placeholder message
    setTimeout(() => {
      this.taskContent = `
        <h2>Tâche #${this.taskId}</h2>
        <p>Contenu généré par l'agent IA</p>
        <p>Cette page affichera le contenu détaillé de la tâche générée.</p>
      `;
      this.isLoading = false;
    }, 500);
  }
}
