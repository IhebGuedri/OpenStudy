import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Cours } from '../../chat/chat.models';
import { catchError, finalize, of, timeout } from 'rxjs';
import jsPDF from 'jspdf';

interface MyCourseCard {
  id: number;
  titre: string;
  chaptersCount: number;
}

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

  private etudiantId: number | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
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

    this.http.get<Cours[]>(`http://localhost:8080/cours/etudiant/${this.etudiantId}`)
      .pipe(
        timeout(15000),
        catchError((error) => {
          console.error('Erreur chargement mes cours:', error);
          this.errorMessage = 'Impossible de charger vos cours pour le moment.';
          return of([] as Cours[]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((courses) => {
        this.ngZone.run(() => {
          const safeCourses = Array.isArray(courses) ? courses : [];
          this.coursesById = new Map(safeCourses.map((course) => [course.id, course]));

          this.myCourses = safeCourses
            .map((course) => ({
              id: course.id,
              titre: (course.titre || '').trim() || 'Sans titre',
              chaptersCount: Array.isArray(course.chapitres) ? course.chapitres.length : 0,
            }));
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
    this.http.post<Cours>(`http://localhost:8080/cours/add/${this.etudiantId}`, {
      titre: 'Nouveau cours',
      visibilite: 'PRIVE'
    })
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
    this.http.delete<void>(`http://localhost:8080/cours/delete/${courseId}`)
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
}
