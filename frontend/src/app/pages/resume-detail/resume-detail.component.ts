import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, finalize, of, takeUntil, timeout } from 'rxjs';
import { marked } from 'marked';
import { ResumeDto, ResumeService } from '../../services/resume.service';

@Component({
  selector: 'app-resume-detail',
  standalone: false,
  templateUrl: './resume-detail.component.html',
  styleUrl: './resume-detail.component.css'
})
export class ResumeDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  errorMessage = '';
  resume: ResumeDto | null = null;
  private destroy$ = new Subject<void>();
  private loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private resumeService: ResumeService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const resumeIdParam = params.get('id');
        const resumeId = Number(resumeIdParam);

        if (!resumeIdParam || Number.isNaN(resumeId)) {
          this.errorMessage = 'Résumé invalide.';
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        this.loadResume(resumeId);
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

  private loadResume(resumeId: number): void {
    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.resume = null;

    this.loadingFallbackTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (!this.errorMessage) {
          this.errorMessage = 'Chargement interrompu. Veuillez rafraichir la page.';
        }
        this.cdr.detectChanges();
      });
    }, 12000);

    this.resumeService.getResumeById(resumeId)
      .pipe(
        timeout(15000),
        catchError((error) => {
          console.error('Error loading resume detail:', error);
          this.errorMessage = 'Impossible de charger ce résumé.';
          return of(null as ResumeDto | null);
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
      .subscribe((resume) => {
        this.ngZone.run(() => {
          this.resume = resume;
          this.cdr.detectChanges();
        });
      });
  }

  goBack(): void {
    this.router.navigate(['/mes-resumes']);
  }

  goToCourse(): void {
    if (!this.resume?.coursId) {
      return;
    }

    this.router.navigate(['/chat'], { queryParams: { courseId: this.resume.coursId } });
  }

  renderMarkdown(content: string): string {
    const safeContent = typeof content === 'string' ? content : '';
    return marked.parse(safeContent, { gfm: true, breaks: true, async: false }) as string;
  }
}