import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibrarycardnumberComponent } from './librarycardnumber.component';

describe('LibrarycardnumberComponent', () => {
  let component: LibrarycardnumberComponent;
  let fixture: ComponentFixture<LibrarycardnumberComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LibrarycardnumberComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LibrarycardnumberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
