import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../config/api.config';

export interface ResumeDto {
  id: number;
  coursId: number;
  coursTitre: string;
  contenu: string;
  dateCreation: string;
  versionIA: string;
}

export interface ResumeUpsertRequest {
  contenu: string;
  versionIA?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResumeService {
  private apiUrl = `${API_ENDPOINTS.springApiBaseUrl}/resumes`;

  constructor(private http: HttpClient) {}

  getMyResumes(etudiantId: number): Observable<ResumeDto[]> {
    return this.http.get<ResumeDto[]>(`${this.apiUrl}/etudiant/${etudiantId}`);
  }

  getResumeById(resumeId: number): Observable<ResumeDto> {
    return this.http.get<ResumeDto>(`${this.apiUrl}/${resumeId}`);
  }

  saveResumeForCourse(coursId: number, request: ResumeUpsertRequest): Observable<ResumeDto> {
    return this.http.post<ResumeDto>(`${this.apiUrl}/cours/${coursId}`, request);
  }
}