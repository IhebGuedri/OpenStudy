import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { API_ENDPOINTS } from '../config/api.config';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    const isSpringApiCall = req.url.startsWith(`${API_ENDPOINTS.springApiBaseUrl}/`);
    const isPublicCourseRequest = this.isPublicCourseRequest(req);

    if (!token || !isSpringApiCall || isPublicCourseRequest) {
      return next.handle(req);
    }

    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && isSpringApiCall && !isPublicCourseRequest) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }

  private isPublicCourseRequest(req: HttpRequest<unknown>): boolean {
    if (req.method !== 'GET') {
      return false;
    }

    try {
      const url = new URL(req.url);
      return url.pathname === '/cours/public'
        || url.pathname.startsWith('/cours/public/')
        || /^\/cours\/\d+$/.test(url.pathname);
    } catch {
      return false;
    }
  }
}
