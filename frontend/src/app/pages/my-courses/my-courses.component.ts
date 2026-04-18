import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Cours, MyCourseCard } from '../../chat/chat.models';
import { catchError, finalize, forkJoin, of, timeout } from 'rxjs';
import jsPDF from 'jspdf';
import { CourseService } from '../../services/course.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-my-courses',
  standalone: false,
  templateUrl: './my-courses.component.html',
  styleUrl: './my-courses.component.css'
})
export class MyCoursesComponent implements OnInit {
  isLoading = false;
  isCreating = false;
  deletingCourseId: number | null = null;
  downloadingCourseId: number | null = null;
  errorMessage = '';
  searchQuery = '';
  myCourses: MyCourseCard[] = [];
  private coursesById = new Map<number, Cours>();
  private readonly starAlertStoragePrefix = 'openstudy.starAlerts';
  private loadingStarIds = new Set<number>();

  private etudiantId: number | null = null;

  constructor(
    private courseService: CourseService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.etudiantId = this.authService.getUserIdFromToken() ?? this.authService.getCurrentUserId();
    if (!this.etudiantId) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadMyCourses();
  }

  loadMyCourses(): void {
    if (!this.etudiantId) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      courses: this.courseService.getUserCourses(this.etudiantId).pipe(
        timeout(15000),
        catchError((error) => {
          console.error('Erreur chargement contenu cours:', error);
          return of([] as Cours[]);
        })
      ),
      cards: this.courseService.getUserCourseCards(this.etudiantId).pipe(
        timeout(15000),
        catchError((error) => {
          console.error('Erreur chargement cartes cours:', error);
          this.errorMessage = 'Impossible de charger vos cours pour le moment.';
          return of([] as MyCourseCard[]);
        })
      )
    })
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe(({ courses, cards }) => {
        this.ngZone.run(() => {
          const safeCourses = Array.isArray(courses) ? courses : [];
          const safeCards = Array.isArray(cards) ? cards : [];

          this.coursesById = new Map(safeCourses.map((course) => [course.id, course]));
          this.myCourses = safeCards.map((course) => ({
            id: course.id,
            titre: (course.titre || '').trim() || 'Sans titre',
            chaptersCount: Number.isFinite(course.chaptersCount) ? course.chaptersCount : 0,
            starsCount: Number.isFinite(course.starsCount) ? course.starsCount : 0,
            starredByMe: !!course.starredByMe,
            latestStarBy: course.latestStarBy ?? null,
            latestStarAtIso: course.latestStarAtIso ?? null,
          }));

          this.notifyNewStarsIfNeeded(this.myCourses);
          this.cdr.detectChanges();
        });
      });
  }

  get filteredCourses(): MyCourseCard[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      return this.myCourses;
    }

    return this.myCourses.filter((course) =>
      course.titre.toLowerCase().includes(query)
    );
  }

  openCourse(courseId: number): void {
    this.router.navigate(['/chat'], { queryParams: { courseId } });
  }

  openResumes(): void {
    this.router.navigate(['/mes-resumes']);
  }

  createNewCourse(): void {
    if (!this.etudiantId || this.isCreating) {
      return;
    }

    this.isCreating = true;
    this.courseService.createCourse(this.etudiantId, 'Nouveau cours')
      .pipe(finalize(() => {
        this.isCreating = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (newCourse) => {
          this.router.navigate(['/chat'], { queryParams: { courseId: newCourse.id } });
        },
        error: (error) => {
          console.error('Erreur creation cours:', error);
          alert('Impossible de creer un nouveau cours.');
        }
      });
  }

  deleteCourse(courseId: number, event?: Event): void {
    event?.stopPropagation();
    if (!(courseId > 0) || this.deletingCourseId === courseId) {
      return;
    }

    const targetCourse = this.myCourses.find((course) => course.id === courseId);
    const confirmed = confirm(`Supprimer "${targetCourse?.titre || 'ce cours'}" ?`);
    if (!confirmed) {
      return;
    }

    this.deletingCourseId = courseId;
    this.courseService.deleteCourse(courseId)
      .pipe(finalize(() => {
        this.deletingCourseId = null;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.myCourses = this.myCourses.filter((course) => course.id !== courseId);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erreur suppression cours:', error);
          alert('Impossible de supprimer le cours.');
        }
      });
  }

  isStarring(courseId: number): boolean {
    return this.loadingStarIds.has(courseId);
  }

  toggleStar(course: MyCourseCard, event: Event): void {
    event.stopPropagation();

    if (!this.etudiantId || this.loadingStarIds.has(course.id)) {
      return;
    }

    this.loadingStarIds.add(course.id);
    const action$ = course.starredByMe
      ? this.courseService.removeStar(course.id, this.etudiantId)
      : this.courseService.addStar(course.id, this.etudiantId);

    action$.pipe(finalize(() => {
      this.loadingStarIds.delete(course.id);
      this.cdr.detectChanges();
    })).subscribe({
      next: (result) => {
        course.starredByMe = result.starredByMe;
        course.starsCount = result.starsCount;
        this.persistSeenStarsSnapshot(this.myCourses);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur lors du star/unstar:', error);
        alert('Impossible de mettre à jour la star pour ce cours.');
        this.cdr.detectChanges();
      }
    });
  }

  downloadCoursePdf(courseId: number, event?: Event): void {
    event?.stopPropagation();
    if (this.downloadingCourseId === courseId) {
      return;
    }

    const course = this.coursesById.get(courseId);
    if (!course) {
      alert('Impossible de retrouver le contenu du cours. Rechargez la page puis réessayez.');
      return;
    }

    this.downloadingCourseId = courseId;

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const left = 15;
      const right = pageWidth - 15;
      const maxWidth = right - left;
      let y = 18;

      const addPageIfNeeded = (requiredHeight = 8) => {
        if (y + requiredHeight > pageHeight - 15) {
          doc.addPage();
          y = 18;
        }
      };

      const addWrappedText = (text: string, fontSize = 11, spacing = 5.2) => {
        const value = (text || '').trim();
        if (!value) {
          return;
        }
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(value, maxWidth);
        for (const line of lines) {
          addPageIfNeeded(spacing);
          doc.text(line, left, y);
          y += spacing;
        }
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      addPageIfNeeded(10);
      doc.text(course.titre?.trim() || 'Cours sans titre', left, y);
      y += 9;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90);
      addPageIfNeeded(6);
      doc.text(`Export PDF - ${new Date().toLocaleString('fr-FR')}`, left, y);
      y += 8;
      doc.setTextColor(0);

      const chapters = Array.isArray(course.chapitres) ? course.chapitres : [];
      if (chapters.length === 0) {
        doc.setFontSize(11);
        addPageIfNeeded(8);
        doc.text('Ce cours ne contient pas encore de chapitre.', left, y);
      } else {
        chapters
          .slice()
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
          .forEach((chapitre, chapterIndex) => {
            y += 2;
            addPageIfNeeded(10);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            addWrappedText(`Chapitre ${chapterIndex + 1}: ${chapitre.titre || 'Sans titre'}`, 14, 6.2);

            const sections = Array.isArray(chapitre.sections) ? chapitre.sections : [];
            if (sections.length === 0) {
              doc.setFont('helvetica', 'normal');
              addWrappedText('Aucune section dans ce chapitre.', 10, 4.8);
              return;
            }

            sections.forEach((section, sectionIndex) => {
              y += 1.5;
              doc.setFont('helvetica', 'bold');
              addWrappedText(
                `Section ${sectionIndex + 1} - ${section.type || 'CONTENU'}`,
                11,
                5
              );

              doc.setFont('helvetica', 'normal');
              addWrappedText(section.contenu || '', 10, 4.8);
            });
          });
      }

      const safeTitle = (course.titre || 'cours')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'cours';

      doc.save(`${safeTitle}.pdf`);
    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('Impossible de générer le PDF pour ce cours.');
    } finally {
      this.downloadingCourseId = null;
      this.cdr.detectChanges();
    }
  }

  private notifyNewStarsIfNeeded(cards: MyCourseCard[]): void {
    if (!this.etudiantId) {
      return;
    }

    const currentName = (this.authService.getUserDisplayName() || '').trim().toLowerCase();
    const previous = this.readSeenStarsSnapshot();

    for (const card of cards) {
      const previousCount = previous[String(card.id)] ?? 0;
      const currentCount = card.starsCount ?? 0;
      const latestStarBy = (card.latestStarBy || '').trim();

      if (currentCount <= previousCount || !latestStarBy) {
        continue;
      }

      if (currentName && latestStarBy.toLowerCase() === currentName) {
        continue;
      }

      this.notificationService.addNotification({
        title: 'Nouvelle star',
        message: `${latestStarBy} a mis une star sur votre cours "${card.titre}"`,
        taskId: `course-${card.id}-star-${currentCount}`,
        courseId: card.id,
        icon: 'star'
      });
    }

    this.persistSeenStarsSnapshot(cards);
  }

  private readSeenStarsSnapshot(): Record<string, number> {
    if (!this.etudiantId) {
      return {};
    }

    const storageKey = `${this.starAlertStoragePrefix}.${this.etudiantId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed)
          .map(([key, value]) => [key, Number(value)] as const)
          .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1]) && entry[1] >= 0)
      );
    } catch {
      return {};
    }
  }

  private persistSeenStarsSnapshot(cards: MyCourseCard[]): void {
    if (!this.etudiantId) {
      return;
    }

    const storageKey = `${this.starAlertStoragePrefix}.${this.etudiantId}`;
    const payload: Record<string, number> = {};
    for (const card of cards) {
      payload[String(card.id)] = Math.max(0, Number(card.starsCount || 0));
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Best effort only.
    }
  }
}
