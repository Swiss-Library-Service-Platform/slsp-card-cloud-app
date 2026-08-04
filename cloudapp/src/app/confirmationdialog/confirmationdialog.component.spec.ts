import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { AppModule } from '../app.module';
import { ConfirmationdialogComponent } from './confirmationdialog.component';

describe('ConfirmationdialogComponent', () => {
  let component: ConfirmationdialogComponent;
  let fixture: ComponentFixture<ConfirmationdialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [{ provide: MatDialogRef, useValue: {} }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ConfirmationdialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
