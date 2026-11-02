import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { AppModule } from '../app.module';
import {
  ConfirmationDialogData,
  ConfirmationdialogComponent,
} from './confirmationdialog.component';

describe('ConfirmationdialogComponent', () => {
  let dialogRef: jasmine.SpyObj<MatDialogRef<ConfirmationdialogComponent>>;
  let fixture: ComponentFixture<ConfirmationdialogComponent>;

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj<MatDialogRef<ConfirmationdialogComponent>>(
      'MatDialogRef',
      ['close'],
    );

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            confirmMessage: 'Delete this exact item?',
          } satisfies ConfirmationDialogData,
        },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      General: { Confirm: 'Confirm', Cancel: 'Cancel' },
    });
    translate.use('en');

    fixture = TestBed.createComponent(ConfirmationdialogComponent);
    fixture.detectChanges();
  });

  it('renders the typed confirmation message supplied when the dialog opens', () => {
    expect(fixture.nativeElement.textContent).toContain(
      'Delete this exact item?',
    );
  });

  it('returns true only from the confirm action and false from cancel', () => {
    const confirm = fixture.nativeElement.querySelector(
      '.confirm-button',
    ) as HTMLButtonElement;
    const cancel = fixture.nativeElement.querySelector(
      '.cancel-button',
    ) as HTMLButtonElement;

    confirm.click();
    cancel.click();

    expect(dialogRef.close.calls.allArgs()).toEqual([[true], [false]]);
  });
});
