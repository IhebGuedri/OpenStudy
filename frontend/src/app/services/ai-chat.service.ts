import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { NotificationService } from './notification.service';
import { Cours } from '../chat/chat.models';
import { API_ENDPOINTS } from '../config/api.config';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChapterConversationRequest {
  course_title: string;
  chapter_title: string;
  question: string;
  existing_sections: string[];
}

export interface ChapterConversationResponse {
  answer: string;
  prompt_source: string;
}

export interface ContentGenerationRequest {
  topic: string;
  content_type: string; // TEXTE_GENERE, EXPLICATION_IA, etc.
  context?: string;
}

export interface ContentGenerationResponse {
  generated_content: string;
}

export interface CourseSummaryChapterRequest {
  titre: string;
  sections: string[];
}

export interface CourseSummaryRequest {
  course_title: string;
  chapters: CourseSummaryChapterRequest[];
}

export interface CourseSummaryResponse {
  summary: string;
  prompt_source: string;
}

@Injectable({
  providedIn: 'root'
})
export class AIChatService {
  private AI_AGENT_BASE_URL = `${API_ENDPOINTS.aiAgentBaseUrl}/api`;
  private sessionId = this.generateSessionId();
  private messages$ = new BehaviorSubject<AIMessage[]>([]);
  private isLoading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  getMessages$(): Observable<AIMessage[]> {
    return this.messages$.asObservable();
  }

  getIsLoading$(): Observable<boolean> {
    return this.isLoading$.asObservable();
  }

  /**
   * Envoyer un message au chat de l'agent IA
   */
  sendMessage(
    userInput: string,
    chapterTitle: string,
    courseTitle: string,
    existingSections: string[],
    taskId?: string
  ): Observable<string> {
    this.isLoading$.next(true);

    // Ajouter le message utilisateur immédiatement
    const userMessage: AIMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };
    this.addMessageToChat(userMessage);

    const request: ChapterConversationRequest = {
      course_title: courseTitle,
      chapter_title: chapterTitle,
      question: userInput,
      existing_sections: existingSections
    };

    // Generate a taskId if not provided
    const generatedTaskId = taskId || `task_${Date.now()}`;

    return this.http.post<ChapterConversationResponse>(
      `${this.AI_AGENT_BASE_URL}/chapter-conversation/reply`,
      request
    ).pipe(
      tap((response: ChapterConversationResponse) => {
        const assistantMessage: AIMessage = {
          id: this.generateMessageId(),
          role: 'assistant',
          content: response.answer,
          timestamp: new Date()
        };
        this.addMessageToChat(assistantMessage);
        this.isLoading$.next(false);

        // Create notification when AI responds
        this.notificationService.addNotification({
          title: 'Réponse de l\'IA reçue',
          message: `Réponse à votre question sur le chapitre "${chapterTitle}"`,
          taskId: generatedTaskId,
          icon: 'chat_bubble'
        });
      }),
      map(() => ''),
      catchError((error) => {
        console.error('Error communicating with AI agent:', error);
        const errorMessage: AIMessage = {
          id: this.generateMessageId(),
          role: 'assistant',
          content: 'Erreur : Impossible de communiquer avec l\'agent IA. Vérifiez que le serveur de l\'agent est démarré.',
          timestamp: new Date()
        };
        this.addMessageToChat(errorMessage);
        this.isLoading$.next(false);
        return of('');
      })
    );
  }

  /**
   * Générer du contenu pour une section specific
   */
  generateContent(
    topic: string,
    contentType: string,
    context?: string,
    taskId?: string
  ): Observable<string> {
    this.isLoading$.next(true);

    const request: ContentGenerationRequest = {
      topic,
      content_type: contentType,
      context
    };

    // Generate a taskId if not provided
    const generatedTaskId = taskId || `task_${Date.now()}`;

    return this.http.post<ContentGenerationResponse>(
      `${this.AI_AGENT_BASE_URL}/generate-content`,
      request
    ).pipe(
      map((response: ContentGenerationResponse) => response.generated_content),
      tap((generatedContent) => {
        this.isLoading$.next(false);

        // Create notification when content is generated
        this.notificationService.addNotification({
          title: 'Tâche générée',
          message: `Contenu généré pour "${topic}"`,
          taskId: generatedTaskId,
          icon: 'check_circle'
        });
      }),
      catchError((error) => {
        console.error('Error generating content:', error);
        this.isLoading$.next(false);
        return of('Erreur lors de la génération du contenu.');
      })
    );
  }

  generateCourseSummary(course: Cours, taskId?: string): Observable<string> {
    this.isLoading$.next(true);

    const request: CourseSummaryRequest = {
      course_title: (course.titre || 'Cours').trim(),
      chapters: (course.chapitres || []).map((chapter) => ({
        titre: chapter.titre || 'Chapitre',
        sections: (chapter.sections || []).map((section) => section.contenu || '')
      }))
    };

    const generatedTaskId = taskId || `summary_${Date.now()}`;

    return this.http.post<CourseSummaryResponse>(
      `${this.AI_AGENT_BASE_URL}/course-summary/generate`,
      request
    ).pipe(
      map((response: CourseSummaryResponse) => response.summary),
      tap(() => {
        this.isLoading$.next(false);

        this.notificationService.addNotification({
          title: 'Résumé généré',
          message: `Résumé prêt pour "${request.course_title}"`,
          taskId: generatedTaskId,
          icon: 'summarize'
        });
      }),
      catchError((error) => {
        console.error('Error generating course summary:', error);
        this.isLoading$.next(false);
        return of('');
      })
    );
  }

  /**
   * Réinitialiser la session (appelé quand on quitte l'édition)
   */
  resetSession(): void {
    this.sessionId = this.generateSessionId();
    this.messages$.next([]);
    this.isLoading$.next(false);
  }

  /**
   * Ajouter un message au chat
   */
  private addMessageToChat(message: AIMessage): void {
    const currentMessages = this.messages$.value;
    this.messages$.next([...currentMessages, message]);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
