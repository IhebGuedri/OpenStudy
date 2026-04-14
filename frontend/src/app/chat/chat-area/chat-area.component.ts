import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChapitreSummary, SectionContenuSummary } from '../chat.models';
import { marked } from 'marked';
import { NotificationService } from '../../services/notification.service';

type SectionType = SectionContenuSummary['type'];

interface ChapterComposerState {
  isMarkdownOpen: boolean;
  markdownDraft: string;
  isConversationOpen: boolean;
  conversationDraft: string;
  isSaving: boolean;
}

interface SectionEditorState {
  isEditing: boolean;
  draftContent: string;
  draftType: SectionType;
  isSaving: boolean;
}

type CoursePlanStep = 'describe' | 'review' | 'creating' | 'done';

interface CoursePlanState {
  step: CoursePlanStep;
  description: string;
  proposedTitle: string;
  planText: string;
  planChapters: string[];
  reviewFeedback: string;
  errorMessage: string;
  sessionId: string;
  iteration: number;
  accepted: boolean;
  generatedChapters: number;
  isLoading: boolean;
}

interface PlanApiResponse {
  session_id: string;
  title: string;
  chapters: string[];
  iteration: number;
  accepted: boolean;
}

interface GenerateChapterApiResponse {
  session_id: string;
  done: boolean;
  chapter_index: number;
  total_chapters: number;
  chapter_title?: string;
  content?: string;
  prompt_source?: string;
}

interface ConversationReplyApiResponse {
  answer: string;
  prompt_source: string;
}

interface CreatedChapterResponse {
  id?: number;
  titre?: string;
  ordre?: number;
}

interface SavedSectionResponse {
  id?: number;
  contenu?: string;
  type?: unknown;
  dateAjout?: string;
  promptSource?: string;
}

@Component({
  selector: 'app-chat-area',
  standalone: false,
  templateUrl: './chat-area.component.html',
  styleUrl: './chat-area.component.css',
})
export class ChatAreaComponent implements OnChanges {
  @Input() chapitres: ChapitreSummary[] = [];
  @Input() isChapitresLoading = false;
  @Input() activeCoursTitre = '';
  @Input() activeCoursId: number | null = null;
  @Input() isEditMode = true;
  @Output() courseTitleUpdated = new EventEmitter<{ courseId: number; title: string }>();
  @ViewChild('scrollAnchor') private scrollAnchor!: ElementRef<HTMLDivElement>;

  chapterComposers: Record<number, ChapterComposerState> = {};
  currentPlanState: CoursePlanState | null = null;
  courseVisibility: 'PUBLIC' | 'PRIVE' = 'PRIVE';
  isTogglingVisibility = false;
  currentUserId: number | null = null;
  sectionEditors: Record<number, SectionEditorState> = {};

  private readonly composerByCourse = new Map<number, Record<number, ChapterComposerState>>();
  private readonly planByCourse = new Map<number, CoursePlanState>();
  private readonly aiAgentBaseUrl = 'http://127.0.0.1:8000';
  private readonly planStorageKey = 'openstudy.coursePlans';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    // Note: AuthService should be injected to get current user ID if needed
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeCoursId'] || changes['chapitres']) {
      this.syncCourseScopedState();
      if (changes['activeCoursId']) {
        this.loadCourseVisibility();
      }
    }

    if (changes['isEditMode'] && !this.isEditMode) {
      this.closeEditingUi();
    }
  }

  private scrollToBottom(): void {
    try {
      this.scrollAnchor?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch (_) {}
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch (_) {}
  }

  private persistActivePlanState(): void {
    if (!this.activeCoursId || this.activeCoursId <= 0 || !this.currentPlanState) {
      return;
    }

    try {
      const raw = localStorage.getItem(this.planStorageKey);
      const store = raw ? JSON.parse(raw) as Record<string, CoursePlanState> : {};
      store[String(this.activeCoursId)] = this.normalizePlanState(this.currentPlanState);
      localStorage.setItem(this.planStorageKey, JSON.stringify(store));
    } catch (error) {
      console.warn('Impossible de persister le plan du cours:', error);
    }
  }

  private getPersistedPlanState(courseId: number): CoursePlanState | null {
    try {
      const raw = localStorage.getItem(this.planStorageKey);
      if (!raw) {
        return null;
      }

      const store = JSON.parse(raw) as Record<string, CoursePlanState>;
      const value = store[String(courseId)];
      return value ? this.normalizePlanState(value) : null;
    } catch (error) {
      console.warn('Impossible de restaurer le plan du cours:', error);
      return null;
    }
  }

  private normalizePlanState(plan: CoursePlanState): CoursePlanState {
    const normalizedStep = plan.step === 'creating' ? 'review' : plan.step;

    return {
      ...plan,
      step: normalizedStep,
      isLoading: false,
    };
  }

  private buildTaskId(suffix: string): string {
    if (this.activeCoursId && this.activeCoursId > 0) {
      return `course-${this.activeCoursId}-${suffix}`;
    }

    return suffix;
  }

  private closeEditingUi(): void {
    Object.values(this.sectionEditors).forEach((editor) => {
      editor.isEditing = false;
    });

    Object.values(this.chapterComposers).forEach((composer) => {
      composer.isMarkdownOpen = false;
      composer.isConversationOpen = false;
      composer.markdownDraft = '';
      composer.conversationDraft = '';
    });

    this.refreshView();
  }

  getComposerForChapitre(chapitreId: number): ChapterComposerState {
    if (!this.chapterComposers[chapitreId]) {
      this.chapterComposers[chapitreId] = {
        isMarkdownOpen: false,
        markdownDraft: '',
        isConversationOpen: false,
        conversationDraft: '',
        isSaving: false,
      };
    }
    return this.chapterComposers[chapitreId];
  }

  getEditorForSection(sectionId: number, initialContent: string, initialType: SectionType): SectionEditorState {
    if (!this.sectionEditors[sectionId]) {
      this.sectionEditors[sectionId] = {
        isEditing: false,
        draftContent: initialContent,
        draftType: initialType,
        isSaving: false,
      };
    }

    return this.sectionEditors[sectionId];
  }

  startSectionEditing(sectionId: number, content: string, type: SectionType): void {
    const editor = this.getEditorForSection(sectionId, content, type);
    editor.isEditing = true;
    editor.draftContent = content;
    editor.draftType = type;
  }

  cancelSectionEditing(sectionId: number, content: string, type: SectionType): void {
    const editor = this.getEditorForSection(sectionId, content, type);
    editor.isEditing = false;
    editor.draftContent = content;
    editor.draftType = type;
  }

  saveSectionEditing(chapitreId: number, sectionId: number): void {
    const chapter = this.chapitres.find((chap) => chap.id === chapitreId);
    const section = chapter?.sections.find((sec) => sec.id === sectionId);
    if (!chapter || !section) {
      return;
    }

    const editor = this.getEditorForSection(sectionId, section.contenu, section.type);
    const newContent = editor.draftContent.trim();
    if (!newContent || editor.isSaving) {
      return;
    }

    editor.isSaving = true;
    this.http.put<SavedSectionResponse>(`http://localhost:8080/sections/update/${sectionId}`, {
      contenu: newContent,
      type: editor.draftType,
      promptSource: section.promptSource ?? 'manual-edit',
    }).subscribe({
      next: (savedSection) => {
        this.chapitres = this.chapitres.map((chapitre) => {
          if (chapitre.id !== chapitreId) {
            return chapitre;
          }

          return {
            ...chapitre,
            sections: chapitre.sections.map((existing) => {
              if (existing.id !== sectionId) {
                return existing;
              }

              return this.mapSavedSection(savedSection, newContent, editor.draftType, existing.promptSource ?? 'manual-edit');
            }),
          };
        });

        editor.isSaving = false;
        editor.isEditing = false;
        this.refreshView();
      },
      error: (error) => {
        console.error('Erreur mise a jour section:', error);
        editor.isSaving = false;
        this.refreshView();
      }
    });
  }

  openMarkdownEditor(chapitreId: number): void {
    const composer = this.getComposerForChapitre(chapitreId);
    composer.isMarkdownOpen = true;
    composer.isConversationOpen = false;
  }

  cancelMarkdownEditor(chapitreId: number): void {
    const composer = this.getComposerForChapitre(chapitreId);
    composer.isMarkdownOpen = false;
    composer.markdownDraft = '';
  }

  openConversationEditor(chapitreId: number): void {
    const composer = this.getComposerForChapitre(chapitreId);
    composer.isConversationOpen = true;
    composer.isMarkdownOpen = false;
  }

  cancelConversationEditor(chapitreId: number): void {
    const composer = this.getComposerForChapitre(chapitreId);
    composer.isConversationOpen = false;
    composer.conversationDraft = '';
  }

  updateMarkdownDraft(chapitreId: number, value: string): void {
    const composer = this.getComposerForChapitre(chapitreId);
    composer.markdownDraft = value;
  }

  updateConversationDraft(chapitreId: number, value: string): void {
    const composer = this.getComposerForChapitre(chapitreId);
    composer.conversationDraft = value;
  }

  updateCourseDescription(value: string): void {
    if (!this.currentPlanState) {
      return;
    }

    this.currentPlanState.description = value;
    this.currentPlanState.errorMessage = '';
    this.persistActivePlanState();
  }

  updatePlanTitle(value: string): void {
    if (!this.currentPlanState) {
      return;
    }

    this.currentPlanState.proposedTitle = value;
    this.persistActivePlanState();
  }

  updatePlanText(value: string): void {
    if (!this.currentPlanState) {
      return;
    }

    this.currentPlanState.planText = value;
    this.currentPlanState.planChapters = this.parsePlanItems(value);
    this.persistActivePlanState();
  }

  updatePlanChapter(index: number, value: string): void {
    if (!this.currentPlanState) {
      return;
    }

    if (index < 0 || index >= this.currentPlanState.planChapters.length) {
      return;
    }

    this.currentPlanState.planChapters[index] = value;
    this.syncPlanTextFromChapters();
    this.persistActivePlanState();
  }

  addPlanChapter(): void {
    if (!this.currentPlanState) {
      return;
    }

    this.currentPlanState.planChapters.push('');
    this.syncPlanTextFromChapters();
    this.persistActivePlanState();
  }

  trackByChapterIndex(index: number): number {
    return index;
  }

  removePlanChapter(index: number): void {
    if (!this.currentPlanState) {
      return;
    }

    if (this.currentPlanState.planChapters.length <= 1) {
      this.currentPlanState.errorMessage = 'Le plan doit contenir au moins un chapitre.';
      return;
    }

    this.currentPlanState.planChapters = this.currentPlanState.planChapters.filter((_, i) => i !== index);
    this.syncPlanTextFromChapters();
    this.persistActivePlanState();
  }

  updateReviewFeedback(value: string): void {
    if (!this.currentPlanState) {
      return;
    }

    this.currentPlanState.reviewFeedback = value;
    this.persistActivePlanState();
  }

  async generatePlanFromDescription(): Promise<void> {
    if (!this.currentPlanState) {
      return;
    }

    const description = this.currentPlanState.description.trim();
    if (!description) {
      this.currentPlanState.errorMessage = 'Ajoutez d abord une description du cours.';
      return;
    }

    if (description.length < 5) {
      this.currentPlanState.errorMessage = 'La description doit contenir au moins 5 caracteres.';
      return;
    }

    this.currentPlanState.isLoading = true;
    this.currentPlanState.errorMessage = '';

    try {
      const response = await firstValueFrom(
        this.http.post<PlanApiResponse>(`${this.aiAgentBaseUrl}/api/course-plan/start`, {
          description,
          topic: this.activeCoursTitre,
        })
      );

      this.currentPlanState.sessionId = response.session_id;
      this.currentPlanState.proposedTitle = response.title;
      this.currentPlanState.planChapters = [...response.chapters];
      this.currentPlanState.planText = response.chapters.join('\n');
      this.currentPlanState.iteration = response.iteration;
      this.currentPlanState.accepted = response.accepted;
      this.currentPlanState.step = 'review';
      
      // Add notification when plan is generated
      this.notificationService.addNotification({
        title: 'Plan généré',
        message: `Un plan de cours "${response.title}" avec ${response.chapters.length} chapitre(s) a été généré`,
        taskId: this.buildTaskId(`plan-${response.session_id}`),
        courseId: this.activeCoursId ?? undefined,
        icon: 'auto_awesome'
      });
      this.persistActivePlanState();
    } catch (error) {
      console.error('Erreur generation plan agent:', error);
      this.currentPlanState.errorMessage = 'Impossible de generer le plan maintenant.';
    } finally {
      this.currentPlanState.isLoading = false;
      this.refreshView();
    }
  }

  async regeneratePlanFromFeedback(): Promise<void> {
    if (!this.currentPlanState || !this.currentPlanState.sessionId) {
      return;
    }

    const manualPlan = this.currentPlanState.planChapters
      .map((chapter) => chapter.trim())
      .filter((chapter) => chapter !== '');

    if (manualPlan.length === 0) {
      this.currentPlanState.errorMessage = 'Ajoutez au moins un chapitre avant regeneration.';
      return;
    }

    this.currentPlanState.isLoading = true;
    this.currentPlanState.errorMessage = '';

    try {
      const response = await firstValueFrom(
        this.http.post<PlanApiResponse>(`${this.aiAgentBaseUrl}/api/course-plan/revise`, {
          session_id: this.currentPlanState.sessionId,
          feedback: this.currentPlanState.reviewFeedback,
          manual_title: this.currentPlanState.proposedTitle.trim(),
          manual_plan: manualPlan,
        })
      );

      this.currentPlanState.proposedTitle = response.title;
      this.currentPlanState.planChapters = [...response.chapters];
      this.currentPlanState.planText = response.chapters.join('\n');
      this.currentPlanState.iteration = response.iteration;
      this.currentPlanState.accepted = response.accepted;
      this.currentPlanState.reviewFeedback = '';
      
      // Add notification when plan is revised
      this.notificationService.addNotification({
        title: 'Plan révisé',
        message: `Le plan a été révisé (itération ${response.iteration}) avec ${response.chapters.length} chapitre(s)`,
        taskId: this.buildTaskId(`plan-revise-${this.currentPlanState.sessionId}`),
        courseId: this.activeCoursId ?? undefined,
        icon: 'edit_note'
      });
      this.persistActivePlanState();
    } catch (error) {
      console.error('Erreur revision plan agent:', error);
      this.currentPlanState.errorMessage = 'Impossible de reviser le plan pour le moment.';
    } finally {
      this.currentPlanState.isLoading = false;
      this.refreshView();
    }
  }

  backToDescriptionStep(): void {
    if (!this.currentPlanState || this.currentPlanState.step === 'creating') {
      return;
    }

    this.currentPlanState.step = 'describe';
  }

  async confirmPlanAndCreateChapters(): Promise<void> {
    if (!this.currentPlanState || !this.activeCoursId || this.activeCoursId <= 0 || !this.currentPlanState.sessionId) {
      return;
    }

    const description = this.currentPlanState.description.trim();
    if (!description) {
      this.currentPlanState.errorMessage = 'Décrivez d abord le topic du cours.';
      this.currentPlanState.step = 'describe';
      return;
    }

    const title = this.currentPlanState.proposedTitle.trim();
    const planItems = this.currentPlanState.planChapters
      .map((chapter) => chapter.trim())
      .filter((chapter) => chapter !== '');

    if (!title) {
      this.currentPlanState.errorMessage = 'Le titre du cours est obligatoire.';
      return;
    }

    if (planItems.length === 0) {
      this.currentPlanState.errorMessage = 'Ajoutez au moins une ligne de plan.';
      return;
    }

    this.currentPlanState.errorMessage = '';
    this.currentPlanState.step = 'creating';
    this.currentPlanState.isLoading = true;

    try {
      const acceptedPlan = await firstValueFrom(
        this.http.post<PlanApiResponse>(`${this.aiAgentBaseUrl}/api/course-plan/accept`, {
          session_id: this.currentPlanState.sessionId,
          final_title: title,
          final_plan: planItems,
        })
      );

      this.currentPlanState.accepted = acceptedPlan.accepted;
      this.currentPlanState.proposedTitle = acceptedPlan.title;
      this.currentPlanState.planChapters = [...acceptedPlan.chapters];
      this.currentPlanState.planText = acceptedPlan.chapters.join('\n');

      await firstValueFrom(this.http.put(`http://localhost:8080/cours/update/${this.activeCoursId}`, { titre: title }));
      this.courseTitleUpdated.emit({ courseId: this.activeCoursId, title });

      const createdChapters: ChapitreSummary[] = [];
      for (let index = 0; index < planItems.length; index += 1) {
        const created = await firstValueFrom(
          this.http.post<CreatedChapterResponse>(`http://localhost:8080/chapitres/add/${this.activeCoursId}`, {
            titre: planItems[index],
            ordre: index + 1,
          })
        );

        if (typeof created.id === 'number' && created.id > 0) {
          createdChapters.push({
            id: created.id,
            titre: typeof created.titre === 'string' && created.titre.trim() !== ''
              ? created.titre
              : planItems[index],
            ordre: typeof created.ordre === 'number' ? created.ordre : index + 1,
            sections: [],
          });
        }
      }

      this.chapitres = createdChapters;
      this.syncCourseScopedState();
      if (this.currentPlanState) {
        this.currentPlanState.accepted = true;
        this.currentPlanState.generatedChapters = 0;
      }
      this.currentPlanState.step = 'done';
      this.scrollToBottom();

      this.notificationService.addNotification({
        title: 'Plan du cours finalise',
        message: `Le plan est applique avec ${createdChapters.length} chapitre(s) crees.`,
        taskId: this.buildTaskId(`plan-complete-${this.currentPlanState.sessionId}`),
        courseId: this.activeCoursId ?? undefined,
        icon: 'task_alt'
      });
      this.persistActivePlanState();
    } catch (error) {
      console.error('Erreur generation plan/chapitres:', error);
      this.currentPlanState.errorMessage = 'Impossible de créer le plan maintenant.';
      this.currentPlanState.step = 'review';
    } finally {
      this.currentPlanState.isLoading = false;
      this.refreshView();
    }
  }

  async generateNextChapterFromAgent(): Promise<void> {
    if (!this.currentPlanState || !this.currentPlanState.sessionId) {
      return;
    }

    if (!this.currentPlanState.accepted) {
      this.currentPlanState.errorMessage = 'Le plan doit etre accepte avant la generation du contenu.';
      return;
    }

    if (this.currentPlanState.generatedChapters >= this.chapitres.length) {
      return;
    }

    this.currentPlanState.errorMessage = '';
    this.currentPlanState.step = 'creating';
    this.currentPlanState.isLoading = true;

    try {
      const result = await firstValueFrom(
        this.http.post<GenerateChapterApiResponse>(`${this.aiAgentBaseUrl}/api/course-content/generate-next-chapter`, {
          session_id: this.currentPlanState.sessionId,
        })
      );

      if (result.done) {
        this.currentPlanState.generatedChapters = this.chapitres.length;
        this.currentPlanState.step = 'done';
        return;
      }

      const chapter = this.resolveChapterForGeneratedContent(result.chapter_index, result.chapter_title ?? '');
      if (!chapter || !result.content) {
        throw new Error('Chapitre cible introuvable pour le contenu genere');
      }

      const savedSection = await firstValueFrom(
        this.http.post<SavedSectionResponse>(`http://localhost:8080/sections/add/${chapter.id}`, {
          contenu: result.content,
          type: 'TEXTE_GENERE',
          promptSource: result.prompt_source ?? 'agent-generated',
        })
      );

      const mapped = this.mapSavedSection(savedSection, result.content, 'TEXTE_GENERE', result.prompt_source ?? 'agent-generated');
      this.chapitres = this.chapitres.map((chapitre) => {
        if (chapitre.id !== chapter.id) {
          return chapitre;
        }

        return {
          ...chapitre,
          sections: [...chapitre.sections, mapped],
        };
      });

      this.currentPlanState.generatedChapters = Math.min(this.currentPlanState.generatedChapters + 1, this.chapitres.length);
      this.currentPlanState.step = 'done';
      this.scrollToBottom();
      
      // Add notification when chapter content is generated
      this.notificationService.addNotification({
        title: 'Chapitre généré',
        message: `Le contenu du chapitre "${chapter.titre}" a été généré par l'IA`,
        taskId: this.buildTaskId(`chapter-${chapter.id}`),
        courseId: this.activeCoursId ?? undefined,
        icon: 'library_books'
      });

      if (this.currentPlanState.generatedChapters >= this.chapitres.length) {
        this.notificationService.addNotification({
          title: 'Cours cree',
          message: `Tous les chapitres du cours "${this.activeCoursTitre || 'Nouveau cours'}" sont generes.`,
          taskId: this.buildTaskId('course-generated-complete'),
          courseId: this.activeCoursId ?? undefined,
          icon: 'task_alt'
        });
      }

      this.persistActivePlanState();
    } catch (error) {
      console.error('Erreur generation chapitre:', error);
      this.currentPlanState.errorMessage = 'Echec generation du chapitre.';
      this.currentPlanState.step = 'done';
    } finally {
      this.currentPlanState.isLoading = false;
      this.refreshView();
    }
  }

  addMarkdownSection(chapitreId: number): void {
    const composer = this.getComposerForChapitre(chapitreId);
    const content = composer.markdownDraft.trim();
    if (!content || composer.isSaving) {
      return;
    }

    composer.isSaving = true;
    this.createSection(
      chapitreId,
      content,
      'NOTE_PERSONNELLE',
      'markdown',
      () => {
        composer.isSaving = false;
        composer.markdownDraft = '';
        composer.isMarkdownOpen = false;
        this.scrollToBottom();
      },
      () => {
        composer.isSaving = false;
      }
    );
  }

  addConversationSection(chapitreId: number): void {
    const composer = this.getComposerForChapitre(chapitreId);
    const question = composer.conversationDraft.trim();
    if (!question || composer.isSaving) {
      return;
    }

    const chapter = this.chapitres.find((chap) => chap.id === chapitreId);
    if (!chapter) {
      return;
    }

    composer.isSaving = true;

    this.createSection(
      chapitreId,
      question,
      'NOTE_PERSONNELLE',
      'conversation-user',
      async () => {
        try {
          const reply = await firstValueFrom(
            this.http.post<ConversationReplyApiResponse>(`${this.aiAgentBaseUrl}/api/chapter-conversation/reply`, {
              course_title: this.activeCoursTitre,
              chapter_title: chapter.titre,
              question,
              existing_sections: chapter.sections.map((section) => section.contenu),
            })
          );

          this.createSection(
            chapitreId,
            reply.answer,
            'EXPLICATION_IA',
            reply.prompt_source,
            () => {
              composer.isSaving = false;
              composer.conversationDraft = '';
              composer.isConversationOpen = false;
              this.scrollToBottom();
              this.refreshView();
            },
            () => {
              composer.isSaving = false;
              this.refreshView();
            }
          );
        } catch (error) {
          console.error('Erreur generation reponse conversation:', error);
          composer.isSaving = false;
          this.refreshView();
        }
      },
      () => {
        composer.isSaving = false;
      }
    );
  }

  private createSection(
    chapitreId: number,
    contenu: string,
    type: SectionType,
    promptSource: string,
    onSuccess: () => void,
    onError: () => void
  ): void {
    const chapter = this.chapitres.find((chapitre) => chapitre.id === chapitreId);
    if (!chapter) {
      onError();
      return;
    }

    this.http.post<SavedSectionResponse>(`http://localhost:8080/sections/add/${chapitreId}`, {
      contenu,
      type,
      promptSource,
    }).subscribe({
      next: (savedSection) => {
        const section = this.mapSavedSection(savedSection, contenu, type, promptSource);
        this.chapitres = this.chapitres.map((chapitre) => {
          if (chapitre.id !== chapitreId) {
            return chapitre;
          }

          return {
            ...chapitre,
            sections: [...chapitre.sections, section],
          };
        });

        onSuccess();
        this.refreshView();
      },
      error: (error) => {
        console.error('Erreur ajout section:', error);
        onError();
        this.refreshView();
      }
    });
  }

  private mapSavedSection(
    savedSection: SavedSectionResponse,
    fallbackContenu: string,
    fallbackType: SectionType,
    fallbackPromptSource: string
  ): SectionContenuSummary {
    return {
      id: typeof savedSection.id === 'number' ? savedSection.id : -Date.now(),
      contenu: typeof savedSection.contenu === 'string' ? savedSection.contenu : fallbackContenu,
      type: this.normalizeSectionType(savedSection.type, fallbackType),
      dateAjout: typeof savedSection.dateAjout === 'string' ? savedSection.dateAjout : undefined,
      promptSource: typeof savedSection.promptSource === 'string' ? savedSection.promptSource : fallbackPromptSource,
    };
  }

  private normalizeSectionType(type: unknown, fallback: SectionType = 'TEXTE_GENERE'): SectionType {
    if (type === 'EXPLICATION_IA' || type === 'NOTE_PERSONNELLE' || type === 'TEXTE_GENERE') {
      return type;
    }

    return fallback;
  }

  formatSectionType(type: string): string {
    switch (type) {
      case 'EXPLICATION_IA':
        return 'Explication IA';
      case 'NOTE_PERSONNELLE':
        return 'Note personnelle';
      case 'TEXTE_GENERE':
      default:
        return 'Texte généré';
    }
  }

  renderMarkdown(content: string): string {
    const safeContent = typeof content === 'string' ? content : '';
    return marked.parse(safeContent, { gfm: true, breaks: true, async: false }) as string;
  }

  private syncCourseScopedState(): void {
    if (!this.activeCoursId || this.activeCoursId <= 0) {
      this.chapterComposers = {};
      this.currentPlanState = null;
      return;
    }

    if (!this.composerByCourse.has(this.activeCoursId)) {
      this.composerByCourse.set(this.activeCoursId, {});
    }

    this.chapterComposers = this.composerByCourse.get(this.activeCoursId) ?? {};

    for (const chapitre of this.chapitres) {
      if (!this.chapterComposers[chapitre.id]) {
        this.chapterComposers[chapitre.id] = {
          isMarkdownOpen: false,
          markdownDraft: '',
          isConversationOpen: false,
          conversationDraft: '',
          isSaving: false,
        };
      }
    }

    if (!this.planByCourse.has(this.activeCoursId)) {
      const persisted = this.getPersistedPlanState(this.activeCoursId);
      this.planByCourse.set(this.activeCoursId, persisted ?? {
        step: 'describe',
        description: '',
        proposedTitle: this.activeCoursTitre || '',
        planText: '',
        planChapters: [],
        reviewFeedback: '',
        errorMessage: '',
        sessionId: '',
        iteration: 0,
        accepted: false,
        generatedChapters: 0,
        isLoading: false,
      });
    }

    this.currentPlanState = this.planByCourse.get(this.activeCoursId) ?? null;

    if (this.currentPlanState) {
      this.currentPlanState = this.normalizePlanState(this.currentPlanState);
      if (this.currentPlanState.proposedTitle.trim() === '' && this.activeCoursTitre.trim() !== '') {
        this.currentPlanState.proposedTitle = this.activeCoursTitre;
      }

      if (this.currentPlanState.planChapters.length === 0 && this.currentPlanState.planText.trim() !== '') {
        this.currentPlanState.planChapters = this.parsePlanItems(this.currentPlanState.planText);
      }

      if (this.chapitres.length > 0) {
        this.currentPlanState.accepted = true;
        this.currentPlanState.step = 'done';
        this.currentPlanState.generatedChapters = this.chapitres.filter((chapitre) =>
          chapitre.sections.some((section) => section.type === 'TEXTE_GENERE')
        ).length;
      } else if (!this.currentPlanState.description.trim()) {
        this.currentPlanState.step = 'describe';
      } else if (this.currentPlanState.step === 'done') {
        this.currentPlanState.step = 'review';
      }

      this.persistActivePlanState();
    }
  }

  private parsePlanItems(rawPlan: string): string[] {
    return rawPlan
      .split('\n')
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter((line) => line !== '');
  }

  private syncPlanTextFromChapters(): void {
    if (!this.currentPlanState) {
      return;
    }

    this.currentPlanState.planText = this.currentPlanState.planChapters
      .map((chapter) => chapter.trim())
      .filter((chapter) => chapter !== '')
      .join('\n');
  }

  private resolveChapterForGeneratedContent(chapterIndex: number, chapterTitle: string): ChapitreSummary | undefined {
    const byOrder = this.chapitres.find((chapitre) => (chapitre.ordre ?? -1) === chapterIndex + 1);
    if (byOrder) {
      return byOrder;
    }

    const normalized = chapterTitle.trim().toLowerCase();
    if (normalized) {
      const byTitle = this.chapitres.find((chapitre) => chapitre.titre.trim().toLowerCase() === normalized);
      if (byTitle) {
        return byTitle;
      }
    }

    return this.chapitres[chapterIndex];
  }

  loadCourseVisibility(): void {
    if (!this.activeCoursId) return;

    this.http.get<any>(`http://localhost:8080/cours/${this.activeCoursId}`)
      .subscribe({
        next: (course) => {
          this.courseVisibility = (course.visibilite as any)?.toUpperCase() === 'PUBLIC' ? 'PUBLIC' : 'PRIVE';
        },
        error: (error) => {
          console.error('Error loading course visibility:', error);
          this.courseVisibility = 'PRIVE';
        }
      });
  }

  toggleCourseVisibility(): void {
    if (!this.activeCoursId) {
      alert('Veuillez sélectionner un cours');
      return;
    }

    this.isTogglingVisibility = true;
    
    if (this.courseVisibility === 'PRIVE') {
      // Make it public
      this.http.put<any>(`http://localhost:8080/cours/openPublic/${this.activeCoursId}`, {})
        .subscribe({
          next: (updatedCourse) => {
            this.courseVisibility = 'PUBLIC';
            alert('Cours rendu public avec succès');
            this.isTogglingVisibility = false;
          },
          error: (error) => {
            console.error('Error making course public:', error);
            alert('Erreur lors de la modification de la visibilité');
            this.isTogglingVisibility = false;
          }
        });
    } else {
      // Make it private
      this.http.put<any>(`http://localhost:8080/cours/update/${this.activeCoursId}`, { visibilite: 'PRIVE' })
        .subscribe({
          next: (updatedCourse) => {
            this.courseVisibility = 'PRIVE';
            alert('Cours rendu privé avec succès');
            this.isTogglingVisibility = false;
          },
          error: (error) => {
            console.error('Error making course private:', error);
            alert('Erreur lors de la modification de la visibilité');
            this.isTogglingVisibility = false;
          }
        });
    }
  }
}
