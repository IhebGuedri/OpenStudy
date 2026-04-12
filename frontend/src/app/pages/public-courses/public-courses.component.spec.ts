import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicCoursesComponent } from './public-courses.component';

describe('PublicCoursesComponent', () => {
  let component: PublicCoursesComponent;
  let fixture: ComponentFixture<PublicCoursesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PublicCoursesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PublicCoursesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
