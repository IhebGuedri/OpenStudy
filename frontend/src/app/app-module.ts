import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';

// Angular Material
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { LoginComponent } from './pages/auth/login/login.component';
import { RegisterComponent } from './pages/auth/register/register.component';
import { ChatLayoutComponent } from './chat/chat-layout/chat-layout.component';
import { ChatSidebarComponent } from './chat/chat-sidebar/chat-sidebar.component';
import { ChatAreaComponent } from './chat/chat-area/chat-area.component';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './services/auth.interceptor';
import { PublicCoursesComponent } from './pages/public-courses/public-courses.component';
import { PublicCourseDetailComponent } from './pages/public-course-detail/public-course-detail.component';
import { AIChatPanelComponent } from './pages/public-course-detail/ai-chat-panel.component';
import { MyCoursesComponent } from './pages/my-courses/my-courses.component';

const MATERIAL_MODULES = [
  MatSidenavModule,
  MatToolbarModule,
  MatButtonModule,
  MatInputModule,
  MatFormFieldModule,
  MatIconModule,
  MatListModule,
  MatCardModule,
  MatDividerModule,
  MatTooltipModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
  MatMenuModule,
];

@NgModule({
  declarations: [
    App,
    LoginComponent,
    RegisterComponent,
    ChatLayoutComponent,
    ChatSidebarComponent,
    ChatAreaComponent,
    MyCoursesComponent,
    PublicCoursesComponent,
    PublicCourseDetailComponent,
    AIChatPanelComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    TextFieldModule,
    RouterModule,
    AppRoutingModule,
    ...MATERIAL_MODULES,
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [App]
})
export class AppModule { }
