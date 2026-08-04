import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { LibrarycardnumberComponent } from './librarycardnumber.component';

describe('LibrarycardnumberComponent', () => {
  let component: LibrarycardnumberComponent;
  let fixture: ComponentFixture<LibrarycardnumberComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LibrarycardnumberComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
