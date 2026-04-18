import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/auth/login/login.component';
import { RegisterComponent } from './pages/auth/register/register.component';
import { ChatLayoutComponent } from './chat/chat-layout/chat-layout.component';
import { PublicCoursesComponent } from './pages/public-courses/public-courses.component';
import { PublicCourseDetailComponent } from './pages/public-course-detail/public-course-detail.component';
import { MyCoursesComponent } from './pages/my-courses/my-courses.component';
import { TaskDetailComponent } from './pages/tasks/task-detail.component';
import { MyResumesComponent } from './pages/my-resumes/my-resumes.component';
import { ResumeDetailComponent } from './pages/resume-detail/resume-detail.component';

const routes: Routes = [
  { path: '', redirectTo: 'mes-cours', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'mes-cours', component: MyCoursesComponent },
  { path: 'chat', component: ChatLayoutComponent },
  { path: 'public-courses', component: PublicCoursesComponent },
  { path: 'public-courses/:id', component: PublicCourseDetailComponent },
  { path: 'mes-resumes', component: MyResumesComponent },
  { path: 'mes-resumes/:id', component: ResumeDetailComponent },
  { path: 'tasks/:id', component: TaskDetailComponent },
  { path: '**', redirectTo: 'mes-cours' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
