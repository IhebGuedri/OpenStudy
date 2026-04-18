import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CourseService } from '../../services/course.service';
import { Cours, PublicCourseCard } from '../../chat/chat.models';
import { Router } from '@angular/router';
import { catchError, finalize, map, of, timeout } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-public-courses',
  standalone: false,
  templateUrl: './public-courses.component.html',
  styleUrl: './public-courses.component.css'
})
export class PublicCoursesComponent implements OnInit {
  publicCourses: PublicCourseCard[] = [];
  isLoading = false;
  downloadingCourseId: number | null = null;
  searchQuery = '';
  errorMessage = '';
  private etudiantId: number | null = null;
  private loadingStarIds = new Set<number>();
  private loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private courseService: CourseService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.etudiantId = this.authService.getUserIdFromToken() ?? this.authService.getCurrentUserId();
    this.loadPublicCourses();
  }

  loadPublicCourses(): void {
    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
    }

    this.isLoading = true;
    this.errorMessage = '';
    // Safety net: never keep the page in loading state forever.
    this.loadingFallbackTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (!this.errorMessage && this.publicCourses.length === 0) {
          this.errorMessage = 'Chargement interrompu. Veuillez rafraichir la page.';
        }
        this.cdr.detectChanges();
      });
    }, 12000);

    const cards$ = this.etudiantId
      ? this.courseService.getPublicCourseCardsForUser(this.etudiantId)
      : this.courseService.getPublicCourseCards();

    cards$.pipe(
      timeout(15000),
      map((response: unknown) => {
        if (Array.isArray(response)) {
          return response as PublicCourseCard[];
        }

        if (response && typeof response === 'object') {
          const wrapped = response as { value?: unknown; data?: unknown; courses?: unknown };
          if (Array.isArray(wrapped.value)) {
            return wrapped.value as PublicCourseCard[];
          }
          if (Array.isArray(wrapped.data)) {
            return wrapped.data as PublicCourseCard[];
          }
          if (Array.isArray(wrapped.courses)) {
            return wrapped.courses as PublicCourseCard[];
          }
        }

        return [];
      }),
      catchError((error) => {
        console.error('Error loading public course cards:', error);
        this.errorMessage = 'Impossible de charger les cours publics pour le moment.';
        this.cdr.detectChanges();
        return of([] as PublicCourseCard[]);
      }),
      finalize(() => {
        if (this.loadingFallbackTimer) {
          clearTimeout(this.loadingFallbackTimer);
          this.loadingFallbackTimer = null;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe((courses) => {
      this.ngZone.run(() => {
        this.publicCourses = Array.isArray(courses) ? courses : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    });
  }

  get filteredCourses(): PublicCourseCard[] {
    const safeCourses = Array.isArray(this.publicCourses) ? this.publicCourses : [];

    if (!this.searchQuery.trim()) {
      return safeCourses;
    }

    return safeCourses.filter(course =>
      (course.titre?.toLowerCase() ?? '').includes(this.searchQuery.toLowerCase()) ||
      (course.ownerName?.toLowerCase() ?? '').includes(this.searchQuery.toLowerCase())
    );
  }

  openCourse(courseId: number): void {
    this.router.navigate(['/public-courses', courseId]);
  }

  isStarring(courseId: number): boolean {
    return this.loadingStarIds.has(courseId);
  }

  toggleStar(course: PublicCourseCard, event: Event): void {
    event.stopPropagation();

    if (!this.etudiantId || this.loadingStarIds.has(course.id)) {
      if (!this.etudiantId) {
        this.router.navigate(['/login']);
      }
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
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur lors du star/unstar:', error);
        this.errorMessage = 'Impossible de mettre à jour la star pour ce cours.';
        this.cdr.detectChanges();
      }
    });
  }

  downloadCoursePdf(courseId: number, event: Event): void {
    event.stopPropagation();

    if (this.downloadingCourseId === courseId) {
      return;
    }

    this.downloadingCourseId = courseId;
    this.courseService.getPublicCourseById(courseId)
      .pipe(finalize(() => {
        this.downloadingCourseId = null;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (course) => this.exportCourseAsPdf(course),
        error: (error) => {
          console.error('Erreur export PDF cours public:', error);
          this.errorMessage = 'Impossible de télécharger ce cours pour le moment.';
          this.cdr.detectChanges();
        }
      });
  }

  private exportCourseAsPdf(course: Cours): void {
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
      addWrappedText(course.titre?.trim() || 'Cours sans titre', 18, 7.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90);
      addPageIfNeeded(6);
      const ownerName = course.proprietaire?.nom || 'Inconnu';
      doc.text(`Auteur: ${ownerName}`, left, y);
      y += 6;
      doc.text(`Export PDF - ${new Date().toLocaleString('fr-FR')}`, left, y);
      y += 8;
      doc.setTextColor(0);

      const chapters = Array.isArray(course.chapitres) ? course.chapitres : [];
      if (chapters.length === 0) {
        addWrappedText('Ce cours ne contient pas encore de chapitre.', 11, 5.2);
      } else {
        chapters
          .slice()
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
          .forEach((chapitre, chapterIndex) => {
            y += 2;
            doc.setFont('helvetica', 'bold');
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
              addWrappedText(`Section ${sectionIndex + 1} - ${section.type || 'CONTENU'}`, 11, 5);

              doc.setFont('helvetica', 'normal');
              addWrappedText(section.contenu || '', 10, 4.8);
            });
          });
      }

      const safeTitle = (course.titre || 'cours_public')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'cours_public';

      doc.save(`${safeTitle}.pdf`);
    } catch (error) {
      console.error('Erreur génération PDF cours public:', error);
      this.errorMessage = 'Impossible de générer le PDF pour ce cours.';
      this.cdr.detectChanges();
    }
  }
}
