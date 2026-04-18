import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Chapitre, Cours, SectionContenu } from '../../chat/chat.models';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';
import { AIChatService } from '../../services/ai-chat.service';
import { NotificationService } from '../../services/notification.service';
import { ResumeService } from '../../services/resume.service';
import { HttpClient } from '@angular/common/http';
import { Subject, catchError, finalize, of, takeUntil, timeout, firstValueFrom } from 'rxjs';
import { marked } from 'marked';

@Component({
  selector: 'app-public-course-detail',
  standalone: false,
  templateUrl: './public-course-detail.component.html',
  styleUrl: './public-course-detail.component.css'
})
export class PublicCourseDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  course: Cours | null = null;
  editableCourse: Cours | null = null;
  isEditMode = false;
  chapterComposers: Record<string, any> = {};
  private readonly aiAgentBaseUrl = 'http://127.0.0.1:8000';
  private etudiantId: number | null = null;
  private loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private courseService: CourseService,
    private authService: AuthService,
    private aiChatService: AIChatService,
    private notificationService: NotificationService,
    private resumeService: ResumeService,
    private httpClient: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.etudiantId = this.authService.getUserIdFromToken() ?? this.authService.getCurrentUserId();

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const courseIdParam = params.get('id');
        const courseId = Number(courseIdParam);

        if (!courseIdParam || Number.isNaN(courseId)) {
          this.errorMessage = 'Cours invalide.';
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        this.loadCourse(courseId);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
      this.loadingFallbackTimer = null;
    }
  }

  private loadCourse(courseId: number): void {
    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.course = null;
    this.editableCourse = null;
    this.isEditMode = false;

    this.loadingFallbackTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (!this.errorMessage) {
          this.errorMessage = 'Chargement interrompu. Veuillez rafraichir la page.';
        }
        this.cdr.detectChanges();
      });
    }, 12000);

    this.courseService.getPublicCourseById(courseId)
      .pipe(
        timeout(15000),
        catchError((error) => {
        console.error('Error loading public course detail:', error);
        this.errorMessage = 'Impossible de charger ce cours public.';
          return of(null as Cours | null);
        }),
        finalize(() => {
          if (this.loadingFallbackTimer) {
            clearTimeout(this.loadingFallbackTimer);
            this.loadingFallbackTimer = null;
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((course) => {
        this.ngZone.run(() => {
          this.course = course;
          this.editableCourse = this.cloneCourse(course);
          this.cdr.detectChanges();
        });
      });
  }

  copyCourseWithoutChanges(): void {
    if (!this.ensureLoggedIn() || !this.course || !this.etudiantId) {
      return;
    }

    const defaultTitle = `${this.course.titre || 'Cours'} (Ma copie)`;
    const newTitle = prompt('Entrez un titre pour votre copie :', defaultTitle);
    if (newTitle === null) {
      return;
    }

    this.saveCopy(newTitle.trim() || defaultTitle);
  }

  async generateResumeFromPublicCourse(): Promise<void> {
    if (!this.ensureLoggedIn() || !this.course || !this.etudiantId) {
      return;
    }

    this.isSaving = true;
    const defaultTitle = `${this.course.titre || 'Cours'} (Copie résumée)`;
    let copiedCourseId: number | null = null;

    try {
      const copiedCourse = await firstValueFrom(
        this.courseService.copyCourseAsPersonal(this.course.id, this.etudiantId, defaultTitle)
      );

      copiedCourseId = copiedCourse.id;

      const summaryContent = await firstValueFrom(this.aiChatService.generateCourseSummary(copiedCourse));
      if (!summaryContent.trim()) {
        throw new Error('Résumé vide');
      }

      const savedResume = await firstValueFrom(
        this.resumeService.saveResumeForCourse(copiedCourse.id, {
          contenu: summaryContent,
          versionIA: 'openStudy-ai-agent'
        })
      );

      this.notificationService.addNotification({
        title: 'Résumé créé',
        message: `Le résumé du cours "${copiedCourse.titre || defaultTitle}" est prêt.`,
        taskId: `resume-${savedResume.id}`,
        courseId: copiedCourse.id,
        icon: 'summarize'
      });

      alert('Résumé généré avec succès.');
      this.isEditMode = false;
      this.aiChatService.resetSession();
      this.router.navigate(['/mes-resumes', savedResume.id]);
    } catch (error: any) {
      console.error('Error generating course resume:', error);

      if (error?.status === 401) {
        alert('Votre session a expire. Veuillez vous reconnecter.');
        this.authService.logout();
        this.router.navigate(['/login']);
        return;
      }

      if (error?.status === 403) {
        alert('Acces refuse. Verifiez que vous etes connecte avec le bon compte.');
        return;
      }

      if (copiedCourseId) {
        alert('La copie a ete créée, mais le résumé a échoué.');
        this.router.navigate(['/chat'], { queryParams: { courseId: copiedCourseId } });
        return;
      }

      alert('Erreur lors de la création du résumé.');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  startEditing(): void {
    if (!this.course) {
      return;
    }
    this.editableCourse = this.cloneCourse(this.course);
    this.isEditMode = true;
    this.cdr.detectChanges();
  }

  cancelEditing(): void {
    this.isEditMode = false;
    if (this.course) {
      this.editableCourse = this.cloneCourse(this.course);
    }
    this.aiChatService.resetSession();
    this.cdr.detectChanges();
  }

  addChapter(): void {
    if (!this.editableCourse) {
      return;
    }

    if (!this.editableCourse.chapitres) {
      this.editableCourse.chapitres = [];
    }

    const newChapter: Chapitre = {
      titre: 'Nouveau chapitre',
      ordre: this.editableCourse.chapitres.length + 1,
      sections: []
    };

    this.editableCourse.chapitres.push(newChapter);
  }

  openMarkdownEditor(index: number): void {
    if (!this.chapterComposers[index]) this.chapterComposers[index] = {};
    this.chapterComposers[index].isMarkdownOpen = true;
    this.chapterComposers[index].isConversationOpen = false;
  }

  cancelMarkdownEditor(index: number): void {
    if (this.chapterComposers[index]) {
      this.chapterComposers[index].isMarkdownOpen = false;
      this.chapterComposers[index].markdownDraft = '';
    }
  }

  addMarkdownSection(chapter: any, index: number): void {
    const draft = this.chapterComposers[index]?.markdownDraft;
    if (!draft?.trim()) return;
    if (!chapter.sections) chapter.sections = [];
    chapter.sections.push({
      contenu: draft,
      type: 'TEXTE_GENERE',
      dateAjout: new Date().toISOString(),
      promptSource: ''
    });
    
    // Create notification
    this.notificationService.addNotification({
      title: 'Contenu ajouté',
      message: `Section ajoutée au chapitre "${chapter.titre}"`,
      taskId: `chapter-${index}-${Date.now()}`,
      icon: 'edit'
    });
    
    this.cancelMarkdownEditor(index);
  }

  openConversationEditor(index: number): void {
    if (!this.chapterComposers[index]) this.chapterComposers[index] = {};
    this.chapterComposers[index].isConversationOpen = true;
    this.chapterComposers[index].isMarkdownOpen = false;
  }

  cancelConversationEditor(index: number): void {
    if (this.chapterComposers[index]) {
        this.chapterComposers[index].isConversationOpen = false;
        this.chapterComposers[index].conversationDraft = '';
    }
  }

  addConversationSection(chapter: any, index: number): void {
    const draft = this.chapterComposers[index]?.conversationDraft;
    if (!draft?.trim() || this.chapterComposers[index]?.isSaving) return;

    if (!chapter.sections) chapter.sections = [];

    this.chapterComposers[index].isSaving = true;

    // Add user question
    chapter.sections.push({
      contenu: draft,
      type: 'NOTE_PERSONNELLE',
      dateAjout: new Date().toISOString(),
      promptSource: 'conversation-user'
    });

    this.cdr.detectChanges();

    // Call API for bot reply
    firstValueFrom(
      this.httpClient.post<any>(`${this.aiAgentBaseUrl}/api/chapter-conversation/reply`, {
        course_title: this.editableCourse?.titre || this.course?.titre || 'Cours',
        chapter_title: chapter.titre,
        question: draft,
        existing_sections: chapter.sections.map((section: any) => section.contenu),
      })
    ).then(
      (reply) => {
        chapter.sections.push({
          contenu: reply.answer,
          type: 'EXPLICATION_IA',
          dateAjout: new Date().toISOString(),
          promptSource: reply.prompt_source
        });
        
        // Create notification
        this.notificationService.addNotification({
          title: 'Réponse reçue',
          message: `L'IA a répondu à votre question sur "${chapter.titre}"`,
          taskId: `chapter-${index}-${Date.now()}`,
          icon: 'smart_toy'
        });
      }
    ).catch(
      (error) => {
        console.error('Error getting an answer:', error);
        if (error?.status === 0) {
          alert('Le serveur IA est injoignable. Lancez ai-agent avec: python -m uvicorn main:app --host 127.0.0.1 --port 8000');
          return;
        }
        alert('Erreur lors de la récupération de la réponse.');
      }
    ).finally(() => {
      this.chapterComposers[index].isSaving = false;
      this.cancelConversationEditor(index);
      this.cdr.detectChanges();
    });
  }

  saveEditedAsCopy(): void {
    if (!this.ensureLoggedIn() || !this.course || !this.editableCourse || !this.etudiantId) {
      return;
    }

    const defaultTitle = `${this.editableCourse.titre || this.course.titre || 'Cours'} (Ma version)`;
    const newTitle = prompt('Titre du nouveau cours personnel :', defaultTitle);
    if (newTitle === null) {
      return;
    }

    this.saveCopy(newTitle.trim() || defaultTitle);
  }

  private saveCopy(title: string): void {
    if (!this.course || !this.etudiantId) {
      return;
    }

    this.isSaving = true;
    this.courseService.copyCourseAsPersonal(this.course.id, this.etudiantId, title)
      .pipe(finalize(() => {
        this.isSaving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (savedCourse) => {
          this.notificationService.addNotification({
            title: 'Copie enregistree',
            message: `Votre copie "${savedCourse.titre || title}" est disponible.`,
            taskId: `course-${savedCourse.id}`,
            courseId: savedCourse.id,
            icon: 'school'
          });
          alert(`Copie enregistrée: ${savedCourse.titre || title}`);
          this.isEditMode = false;
          this.aiChatService.resetSession();
          this.router.navigate(['/chat'], { queryParams: { courseId: savedCourse.id } });
        },
        error: (error) => {
          console.error('Error saving copied course:', error);
          if (error?.status === 401) {
            alert('Votre session a expire. Veuillez vous reconnecter.');
            this.authService.logout();
            this.router.navigate(['/login']);
            return;
          }

          if (error?.status === 403) {
            alert('Acces refuse. Verifiez que vous etes connecte avec le bon compte.');
            return;
          }

          alert('Erreur lors de la sauvegarde de la copie.');
        }
      });
  }

  private ensureLoggedIn(): boolean {
    const token = this.authService.getToken();
    this.etudiantId = this.authService.getUserIdFromToken() ?? this.authService.getCurrentUserId();

    if (token && this.etudiantId) {
      return true;
    }
    alert('Veuillez vous connecter pour copier ou modifier ce cours.');
    this.authService.logout();
    this.router.navigate(['/login']);
    return false;
  }

  private cloneCourse(course: Cours | null): Cours | null {
    if (!course) {
      return null;
    }
    return JSON.parse(JSON.stringify(course)) as Cours;
  }

  goBack(): void {
    this.router.navigate(['/public-courses']);
  }

  renderMarkdown(content: string): string {
    const safeContent = typeof content === 'string' ? content : '';
    return marked.parse(safeContent, { gfm: true, breaks: true, async: false }) as string;
  }
}
