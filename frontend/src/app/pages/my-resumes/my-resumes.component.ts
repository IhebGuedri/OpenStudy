import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ResumeDto, ResumeService } from '../../services/resume.service';
import { catchError, finalize, of, timeout } from 'rxjs';

interface ResumeCard {
  id: number;
  coursId: number;
  coursTitre: string;
  preview: string;
  dateCreation: string;
  versionIA: string;
}

@Component({
  selector: 'app-my-resumes',
  standalone: false,
  templateUrl: './my-resumes.component.html',
  styleUrl: './my-resumes.component.css'
})
export class MyResumesComponent implements OnInit {
  resumes: ResumeCard[] = [];
  isLoading = false;
  searchQuery = '';
  errorMessage = '';
  private etudiantId: number | null = null;
  private loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private resumeService: ResumeService,
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

    this.loadResumes();
  }

  loadResumes(): void {
    if (!this.etudiantId) {
      return;
    }

    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.loadingFallbackTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (!this.errorMessage && this.resumes.length === 0) {
          this.errorMessage = 'Chargement interrompu. Veuillez rafraichir la page.';
        }
        this.cdr.detectChanges();
      });
    }, 12000);

    this.resumeService.getMyResumes(this.etudiantId)
      .pipe(
        timeout(15000),
        catchError((error) => {
          console.error('Erreur chargement des résumés:', error);
          this.errorMessage = 'Impossible de charger vos résumés pour le moment.';
          return of([] as ResumeDto[]);
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
      .subscribe((resumes) => {
        this.ngZone.run(() => {
          this.resumes = (Array.isArray(resumes) ? resumes : []).map((resume) => ({
            id: resume.id,
            coursId: resume.coursId,
            coursTitre: (resume.coursTitre || 'Cours').trim() || 'Cours',
            preview: this.createPreview(resume.contenu),
            dateCreation: resume.dateCreation,
            versionIA: resume.versionIA || 'openStudy-ai-agent'
          }));
          this.cdr.detectChanges();
        });
      });
  }

  get filteredResumes(): ResumeCard[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      return this.resumes;
    }

    return this.resumes.filter((resume) =>
      resume.coursTitre.toLowerCase().includes(query) ||
      resume.preview.toLowerCase().includes(query)
    );
  }

  openResume(resumeId: number, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/mes-resumes', resumeId]);
  }

  goToCourses(): void {
    this.router.navigate(['/mes-cours']);
  }

  openCourse(courseId: number, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/chat'], { queryParams: { courseId } });
  }

  private createPreview(content: string): string {
    const normalized = (content || '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return 'Aucun contenu disponible.';
    }

    return normalized.length > 180 ? `${normalized.slice(0, 180).trim()}...` : normalized;
  }
}