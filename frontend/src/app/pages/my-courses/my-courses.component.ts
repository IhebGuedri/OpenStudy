import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Cours } from '../../chat/chat.models';
import { catchError, finalize, of, timeout } from 'rxjs';

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
  errorMessage = '';
  searchQuery = '';
  myCourses: MyCourseCard[] = [];

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
          this.myCourses = (Array.isArray(courses) ? courses : [])
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
}
