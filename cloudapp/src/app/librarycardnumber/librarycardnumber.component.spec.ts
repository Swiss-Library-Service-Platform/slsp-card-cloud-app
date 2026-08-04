import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { LibraryManagementService } from '../services/library-management.service';
import { createLibraryManagementStub } from '../../testing/library-management.stub';
import { LibrarycardnumberComponent } from './librarycardnumber.component';

describe('LibrarycardnumberComponent', () => {
  let component: LibrarycardnumberComponent;
  let fixture: ComponentFixture<LibrarycardnumberComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        {
          provide: LibraryManagementService,
          useFactory: createLibraryManagementStub,
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LibrarycardnumberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.currentFullName).toBe('Test Patron');
    expect(component.currentLibraryCardNumbers).toEqual([]);
  });
});
