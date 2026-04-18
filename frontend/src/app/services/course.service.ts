import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Cours, Courstitre, PublicCourseCard, MyCourseCard, CourseStarStatus, CourseStarAction } from '../chat/chat.models';

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private apiUrl = 'http://localhost:8080/cours';

  constructor(private http: HttpClient) {}

  // Get all public courses
  getPublicCourses(): Observable<Cours[]> {
    return this.http.get<Cours[]>(`${this.apiUrl}/public`);
  }

  // Get lightweight public course cards
  getPublicCourseCards(): Observable<PublicCourseCard[]> {
    return this.http.get<PublicCourseCard[]>(`${this.apiUrl}/public/cards`);
  }

  // Get lightweight public course cards with personalized star state
  getPublicCourseCardsForUser(etudiantId: number): Observable<PublicCourseCard[]> {
    return this.http.get<PublicCourseCard[]>(`${this.apiUrl}/cards/public/etudiant/${etudiantId}`);
  }

  // Get one public course details
  getPublicCourseById(courseId: number): Observable<Cours> {
    return this.http.get<Cours>(`${this.apiUrl}/public/${courseId}`);
  }

  // Get user's courses
  getUserCourses(etudiantId: number): Observable<Cours[]> {
    return this.http.get<Cours[]>(`${this.apiUrl}/etudiant/${etudiantId}`);
  }

  // Get user's course cards with star analytics
  getUserCourseCards(etudiantId: number): Observable<MyCourseCard[]> {
    return this.http.get<MyCourseCard[]>(`${this.apiUrl}/etudiant/${etudiantId}/cards`);
  }

  // Get course titles only
  getUserCourseTitles(etudiantId: number): Observable<Courstitre[]> {
    return this.http.get<Courstitre[]>(`${this.apiUrl}/titre/${etudiantId}`);
  }

  // Get single course details
  getCourseById(courseId: number, etudiantId: number): Observable<Cours> {
    return this.http.get<Cours>(`${this.apiUrl}/${courseId}/etudiant/${etudiantId}`);
  }

  // Create new course
  createCourse(etudiantId: number, titre: string): Observable<Cours> {
    return this.http.post<Cours>(
      `${this.apiUrl}/add/${etudiantId}`,
      { titre }
    );
  }

  // Update course title
  updateCourseTitle(courseId: number, titre: string): Observable<Cours> {
    return this.http.put<Cours>(
      `${this.apiUrl}/update/${courseId}`,
      { titre }
    );
  }

  // Make course public
  makeCoursPublic(courseId: number): Observable<Cours> {
    return this.http.put<Cours>(`${this.apiUrl}/openPublic/${courseId}`, {});
  }

  // Make course private
  makeCoursPrivate(courseId: number): Observable<Cours> {
    return this.http.put<Cours>(`${this.apiUrl}/update/${courseId}`, { visibilite: 'PRIVE' });
  }

  // Delete course
  deleteCourse(courseId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/delete/${courseId}`);
  }

  // Copy a public course as user's personal course
  copyCourseAsPersonal(publicCourseId: number, etudiantId: number, newTitle?: string): Observable<Cours> {
    return this.http.post<Cours>(
      `${this.apiUrl}/copy/${publicCourseId}/etudiant/${etudiantId}`,
      { titre: newTitle }
    );
  }

  // Add a star to a course
  addStar(coursId: number, etudiantId: number): Observable<CourseStarAction> {
    return this.http.put<CourseStarAction>(`${this.apiUrl}/${coursId}/stars/etudiant/${etudiantId}`, {});
  }

  // Remove a star from a course
  removeStar(coursId: number, etudiantId: number): Observable<CourseStarAction> {
    return this.http.delete<CourseStarAction>(`${this.apiUrl}/${coursId}/stars/etudiant/${etudiantId}`);
  }

  // Read personalized star status for a course
  getStarStatus(coursId: number, etudiantId: number): Observable<CourseStarStatus> {
    return this.http.get<CourseStarStatus>(`${this.apiUrl}/${coursId}/stars/etudiant/${etudiantId}`);
  }
}
