import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CourseService } from '../../services/course.service';
import { PublicCourseCard } from '../../chat/chat.models';
import { Router } from '@angular/router';
import { catchError, finalize, map, of, timeout } from 'rxjs';

@Component({
  selector: 'app-public-courses',
  standalone: false,
  templateUrl: './public-courses.component.html',
  styleUrl: './public-courses.component.css'
})
export class PublicCoursesComponent implements OnInit {
  publicCourses: PublicCourseCard[] = [];
  isLoading = false;
  searchQuery = '';
  errorMessage = '';
  private loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private courseService: CourseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
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

    this.courseService.getPublicCourseCards().pipe(
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
}
