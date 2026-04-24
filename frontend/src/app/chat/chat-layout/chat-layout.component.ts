import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ChapitreSummary, Cours, Courstitre, SectionContenuSummary } from '../chat.models';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { API_ENDPOINTS } from '../../config/api.config';

@Component({
  selector: 'app-chat-layout',
  standalone: false,
  templateUrl: './chat-layout.component.html',
  styleUrl: './chat-layout.component.css',
})
export class ChatLayoutComponent implements OnInit, OnDestroy {
  isSidebarOpen = true;
  isCoursesLoading = false;
  isChapitresLoading = false;

  conversations: Courstitre[] = [];
  chapitresActifs: ChapitreSummary[] = [];
  etudiantId: number | null = null;
  private isCleaningUpEmptyCourses = false;
  private readonly courseEditModeById = new Map<number, boolean>();

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private notificationService: NotificationService
  ) {}

  get activeCourseTitle(): string {
    return this.conversations[this.activeConversationIndex]?.titre ?? '';
  }

  get activeCoursId(): number | null {
    const activeCourse = this.conversations[this.activeConversationIndex];
    return activeCourse && activeCourse.id > 0 ? activeCourse.id : null;
  }

  get isCurrentCourseEditMode(): boolean {
    const activeCourseId = this.activeCoursId;
    if (!activeCourseId || activeCourseId <= 0) {
      return true;
    }

    return this.courseEditModeById.get(activeCourseId) ?? false;
  }

  ngOnInit(): void {
    this.etudiantId = this.authService.getCurrentUserId();
    if (!this.etudiantId) {
      this.router.navigate(['/login']);
      return;
    }

    this.fetchCourses();
  }

  ngOnDestroy(): void {
    // Keep empty/in-progress courses so background generation results can be reopened later.
  }

  fetchCourses(): void {
    if (!this.etudiantId) {
      return;
    }

    this.isCoursesLoading = true;
    this.http.get<Cours[]>(`${API_ENDPOINTS.springApiBaseUrl}/cours/etudiant/${this.etudiantId}`)
      .subscribe({
        next: (coursesResponse) => {
          const allCourses = Array.isArray(coursesResponse) ? coursesResponse : [];
          const requestedCourseId = Number(this.route.snapshot.queryParamMap.get('courseId'));
          const keepRequestedCourse = Number.isFinite(requestedCourseId) && requestedCourseId > 0;

          this.conversations = allCourses
            .map((course) => ({
              id: course.id,
              titre: course.titre ?? '',
            }))
            .filter((cours) => cours.titre.trim() !== '');
          this.finalizeCoursesLoad();
        },
        error: (error) => {
          console.error('Erreur API:', error);
          this.isCoursesLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private finalizeCoursesLoad(): void {
    const requestedCourseId = Number(this.route.snapshot.queryParamMap.get('courseId'));
    if (Number.isFinite(requestedCourseId) && requestedCourseId > 0) {
      const requestedIndex = this.conversations.findIndex((cours) => cours.id === requestedCourseId);
      if (requestedIndex >= 0) {
        this.activeConversationIndex = requestedIndex;
      }
    }

    if (this.activeConversationIndex >= this.conversations.length) {
      this.activeConversationIndex = this.conversations.length - 1;
    }
    if (this.activeConversationIndex === -1 && this.conversations.length > 0) {
      this.activeConversationIndex = 0;
    }

    if (this.activeConversationIndex >= 0) {
      this.loadChapitresForActiveCourse();
    } else {
      this.chapitresActifs = [];
    }

    this.isCoursesLoading = false;
    this.cdr.detectChanges();
  }

  activeConversationIndex = -1;

  onNewConversation(): void {
    if (!this.etudiantId) {
      return;
    }

    const body = { titre: 'Nouveau cours', visibilite: 'PRIVE' };
    this.http.post<Cours>(`${API_ENDPOINTS.springApiBaseUrl}/cours/add/${this.etudiantId}`, body)
      .subscribe({
        next: (newCours) => {
          const titre = newCours.titre && newCours.titre.trim() !== '' ? newCours.titre : 'Nouveau cours';
          this.conversations = [
            ...this.conversations,
            { id: newCours.id, titre }
          ];
          this.courseEditModeById.set(newCours.id, true);
          this.activeConversationIndex = this.conversations.length - 1;
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { courseId: newCours.id },
            queryParamsHandling: 'merge',
          });
          this.loadChapitresForActiveCourse();
        },
        error: (error) => {
          console.error('Erreur ajout cours:', error);
        }
      });
  }


  onSelectConversation(index: number): void {
    if (index < 0 || index >= this.conversations.length) {
      return;
    }

    this.activeConversationIndex = index;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { courseId: this.conversations[index].id },
      queryParamsHandling: 'merge',
    });
    this.loadChapitresForActiveCourse();
  }

  onDeleteCourse(courseId: number): void {
    if (!(courseId > 0)) {
      return;
    }

    const courseIndex = this.conversations.findIndex((cours) => cours.id === courseId);
    if (courseIndex < 0) {
      return;
    }

    const targetTitle = this.conversations[courseIndex]?.titre || 'ce cours';
    const confirmed = confirm(`Supprimer "${targetTitle}" ?`);
    if (!confirmed) {
      return;
    }

    this.http.delete<void>(`${API_ENDPOINTS.springApiBaseUrl}/cours/delete/${courseId}`)
      .subscribe({
        next: () => {
          this.courseEditModeById.delete(courseId);
          const wasActive = courseIndex === this.activeConversationIndex;
          this.conversations = this.conversations.filter((cours) => cours.id !== courseId);

          if (this.conversations.length === 0) {
            this.activeConversationIndex = -1;
            this.chapitresActifs = [];
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { courseId: null },
              queryParamsHandling: 'merge',
            });
            this.cdr.detectChanges();
            return;
          }

          if (wasActive) {
            const fallbackIndex = Math.min(courseIndex, this.conversations.length - 1);
            this.activeConversationIndex = fallbackIndex;
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { courseId: this.conversations[fallbackIndex].id },
              queryParamsHandling: 'merge',
            });
            this.loadChapitresForActiveCourse();
            return;
          }

          if (courseIndex < this.activeConversationIndex) {
            this.activeConversationIndex -= 1;
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erreur suppression cours:', error);
          alert('Impossible de supprimer le cours.');
        }
      });
  }

  saveCourseForReading(): void {
    this.setCurrentCourseEditMode(false);
  }

  enableCourseEditing(): void {
    this.setCurrentCourseEditMode(true);
  }

  private setCurrentCourseEditMode(isEditMode: boolean): void {
    const activeCourseId = this.activeCoursId;
    if (!activeCourseId || activeCourseId <= 0) {
      return;
    }

    this.courseEditModeById.set(activeCourseId, isEditMode);
    this.cdr.detectChanges();
  }

  private ensureCourseDisplayMode(courseId: number, chapterCount: number): void {
    if (this.courseEditModeById.has(courseId)) {
      return;
    }

    // Existing courses open clean by default; empty ones stay editable for initialization.
    this.courseEditModeById.set(courseId, chapterCount === 0);
  }

  onCourseTitleUpdated(event: { courseId: number; title: string }): void {
    const cleanTitle = event.title.trim();
    if (!cleanTitle) {
      return;
    }

    this.conversations = this.conversations.map((cours) =>
      cours.id === event.courseId ? { ...cours, titre: cleanTitle } : cours
    );
  }

  private loadChapitresForActiveCourse(retriesLeft: number = 2): void {
    const activeCourse = this.conversations[this.activeConversationIndex];
    if (!activeCourse || activeCourse.id <= 0) {
      this.chapitresActifs = [];
      this.isChapitresLoading = false;
      return;
    }

    this.isChapitresLoading = true;
    this.http.get<ChapitreSummary[]>(`${API_ENDPOINTS.springApiBaseUrl}/chapitres/cours/${activeCourse.id}`)
      .subscribe({
        next: (response) => {
          const mappedChapitres = this.mapChapitres((Array.isArray(response) ? response : []));
          if (mappedChapitres.length === 0) {
            this.loadChapitresFromCoursEndpoint(activeCourse.id, retriesLeft);
            return;
          }

          this.chapitresActifs = mappedChapitres;
          this.ensureCourseDisplayMode(activeCourse.id, mappedChapitres.length);

          this.isChapitresLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erreur chargement chapitres:', error);
          this.loadChapitresFromCoursEndpoint(activeCourse.id, retriesLeft);
        }
      });
  }

  private loadChapitresFromCoursEndpoint(coursId: number, retriesLeft: number = 2): void {
    if (!this.etudiantId) {
      this.chapitresActifs = [];
      this.isChapitresLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.http.get<Cours>(`${API_ENDPOINTS.springApiBaseUrl}/cours/${coursId}/etudiant/${this.etudiantId}`)
      .subscribe({
        next: (cours) => {
          const mappedChapitres = this.mapChapitres(Array.isArray(cours.chapitres) ? cours.chapitres : []);
          if (mappedChapitres.length === 0 && retriesLeft > 0) {
            setTimeout(() => {
              if (this.activeCoursId === coursId) {
                this.loadChapitresForActiveCourse(retriesLeft - 1);
              }
            }, 700);
            return;
          }

          this.chapitresActifs = mappedChapitres;
          this.ensureCourseDisplayMode(coursId, this.chapitresActifs.length);

          this.isChapitresLoading = false;
          this.cdr.detectChanges();
        },
        error: (fallbackError) => {
          console.error('Erreur fallback chapitres:', fallbackError);
          if (retriesLeft > 0) {
            setTimeout(() => {
              if (this.activeCoursId === coursId) {
                this.loadChapitresForActiveCourse(retriesLeft - 1);
              }
            }, 700);
            return;
          }

          this.chapitresActifs = [];
          this.isChapitresLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private mapChapitres(chapitres: Array<{ id?: unknown; titre?: unknown; ordre?: unknown; sections?: unknown }>): ChapitreSummary[] {
    return chapitres
      .map((chapitre, index) => ({
        id: typeof chapitre.id === 'number' ? chapitre.id : -(index + 1),
        titre: typeof chapitre.titre === 'string' ? chapitre.titre : '',
        ordre: typeof chapitre.ordre === 'number' ? chapitre.ordre : null,
        sections: this.mapSections(chapitre.sections),
      }))
      .filter((chapitre) => chapitre.titre.trim() !== '');
  }

  private mapSections(sections: unknown): SectionContenuSummary[] {
    if (!Array.isArray(sections)) {
      return [];
    }

    return sections
      .map((section, index) => {
        const safeSection = section as {
          id?: unknown;
          contenu?: unknown;
          type?: unknown;
          dateAjout?: unknown;
          promptSource?: unknown;
        };

        return {
          id: typeof safeSection.id === 'number' ? safeSection.id : -(index + 1),
          contenu: typeof safeSection.contenu === 'string' ? safeSection.contenu : '',
          type: this.normalizeSectionType(safeSection.type),
          dateAjout: typeof safeSection.dateAjout === 'string' ? safeSection.dateAjout : undefined,
          promptSource: typeof safeSection.promptSource === 'string' ? safeSection.promptSource : undefined,
        };
      })
      .filter((section) => section.contenu.trim() !== '');
  }

  private normalizeSectionType(type: unknown): SectionContenuSummary['type'] {
    if (type === 'EXPLICATION_IA' || type === 'NOTE_PERSONNELLE' || type === 'TEXTE_GENERE') {
      return type;
    }

    return 'TEXTE_GENERE';
  }

  private cleanupPendingEmptyCourses(): Observable<void> {
    if (this.isCleaningUpEmptyCourses || !this.etudiantId) {
      return of(void 0);
    }

    this.isCleaningUpEmptyCourses = true;
    return this.http.get<Cours[]>(`${API_ENDPOINTS.springApiBaseUrl}/cours/etudiant/${this.etudiantId}`).pipe(
      map((coursesResponse) => Array.isArray(coursesResponse) ? coursesResponse : []),
      map((courses) =>
        courses
          .filter((course) => this.isCourseEmpty(course))
          .map((course) => course.id)
          .filter((id) => typeof id === 'number' && id > 0)
      ),
      switchMap((courseIds) => this.deleteCoursesByIds(courseIds)),
      map(() => void 0),
      catchError((error) => {
        console.warn('Nettoyage auto des cours vides echoue:', error);
        return of(void 0);
      }),
      finalize(() => {
        this.isCleaningUpEmptyCourses = false;
      })
    );
  }

  private isCourseEmpty(course: Cours | null | undefined): boolean {
    const chapters = Array.isArray(course?.chapitres) ? course!.chapitres : [];
    return chapters.length === 0;
  }

  private deleteCoursesByIds(courseIds: number[]): Observable<void> {
    const validIds = courseIds.filter((id) => typeof id === 'number' && id > 0);
    if (validIds.length === 0) {
      return of(void 0);
    }

    return forkJoin(
      validIds.map((courseId) =>
        this.http.delete<void>(`${API_ENDPOINTS.springApiBaseUrl}/cours/delete/${courseId}`).pipe(
          catchError((error) => {
            console.warn('Suppression auto du cours vide echouee:', courseId, error);
            return of(void 0);
          })
        )
      )
    ).pipe(map(() => void 0));
  }
}
