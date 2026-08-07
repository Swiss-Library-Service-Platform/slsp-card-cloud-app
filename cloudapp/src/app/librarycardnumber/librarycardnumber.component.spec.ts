import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  AlertService,
  Entity,
  EntityType,
} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { AppModule } from '../app.module';
import { CardPatron, LibraryCardNumberView } from '../models/card-api.model';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';
import { ConfirmationdialogComponent } from '../confirmationdialog/confirmationdialog.component';
import { LibraryCardNumberComponent } from './librarycardnumber.component';

describe('LibraryCardNumberComponent', () => {
  let alert: jasmine.SpyObj<AlertService>;
  let api: jasmine.SpyObj<PatronApiService>;
  let component: LibraryCardNumberComponent;
  let dialog: jasmine.SpyObj<MatDialog>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<ConfirmationdialogComponent>>;
  let fixture: ComponentFixture<LibraryCardNumberComponent>;
  let patronState$: BehaviorSubject<PatronState>;
  let state: jasmine.SpyObj<PatronStateService>;
  const selected: Entity = {
    id: 'patron-1',
    type: EntityType.USER,
    link: '/users/patron-1',
    description: 'Selected patron',
  };
  const context = { patronId: 'patron-1' } as PatronMutationContext;
  const removableCard: LibraryCardNumberView = {
    value: 'slsp123456789',
    alias: false,
    removable: true,
    elementReference: 'card-reference',
  };
  const aliasCard: LibraryCardNumberView = {
    value: '12-345-678',
    alias: true,
    removable: false,
    elementReference: null,
  };
  const patron: CardPatron = {
    fullName: 'Test Patron',
    external: false,
    libraryCardNumbers: [removableCard, aliasCard],
    matriculationNumber: '12345678',
    dashedMatriculationNumber: '12-345-678',
    blocks: {},
    postalAddresses: [],
  };
  const updatedPatron: CardPatron = {
    ...patron,
    libraryCardNumbers: [aliasCard],
  };

  beforeEach(async () => {
    patronState$ = new BehaviorSubject<PatronState>({
      status: 'ready',
      entity: selected,
      patron,
    });
    state = jasmine.createSpyObj<PatronStateService>(
      'PatronStateService',
      ['currentMutationContext', 'replacePatron'],
      { patronState$ },
    );
    state.currentMutationContext.and.returnValue(context);
    api = jasmine.createSpyObj<PatronApiService>('PatronApiService', [
      'addLibraryCardNumber',
      'removeLibraryCardNumber',
    ]);
    alert = jasmine.createSpyObj<AlertService>('AlertService', [
      'error',
      'success',
      'warn',
    ]);
    dialogRef = jasmine.createSpyObj<MatDialogRef<ConfirmationdialogComponent>>(
      'MatDialogRef',
      ['afterClosed'],
    );
    dialogRef.afterClosed.and.returnValue(of(true));
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialog.open.and.returnValue(dialogRef);

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: PatronApiService, useValue: api },
        { provide: PatronStateService, useValue: state },
        { provide: AlertService, useValue: alert },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      LibraryCardNumber: {
        Add: 'Add',
        Alias: 'Alias',
        CurrentLibraryCardNumbers: 'Current Library Card Numbers',
        CurrentMatriculationNumber: 'Current matriculation number',
        NoCurrentLibraryCardNumbers: 'No card numbers',
        Remove: 'Remove',
        Sure: 'Remove this exact number?',
        RemoveSuccess: 'Card removed',
        RemoveError: 'Card removal failed',
        FomatError: 'Required card number',
        AddError: 'Card addition failed',
        AddSuccess: 'Card added',
        ManagedIdentifier: 'Managed identifier',
      },
      Main: { Cards: 'Cards', LibraryCardNumber: 'Card Number' },
      Errors: {
        DuplicateLibraryCardNumber: 'This card number is already in use.',
        UnexpectedFailure: 'An unexpected error occurred.',
        SelectedPatron: 'The selected patron',
        SupportId: 'Support ID: {{errorId}}',
      },
    });
    translate.use('en');

    fixture = TestBed.createComponent(LibraryCardNumberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders DTO matriculation, alias, and removability flags', () => {
    const text = fixture.nativeElement.textContent as string;
    const removeButtons = fixture.nativeElement.querySelectorAll(
      '[data-action="remove-card"]',
    ) as NodeListOf<HTMLButtonElement>;

    expect(text).toContain('12345678');
    expect(text).toContain('12-345-678');
    expect(text).toContain('Alias');
    expect(removeButtons.length).toBe(1);
    expect(
      fixture.nativeElement.querySelectorAll(
        '[data-library-card-number] .slsp-data-row__label',
      ).length,
    ).toBe(0);
    expect(
      fixture.nativeElement.querySelector('.library-card-number-row__value'),
    ).not.toBeNull();
  });

  it('uses one flat Cards section with an integrated add form', () => {
    expect(
      fixture.nativeElement.querySelectorAll('[data-section="cards"]').length,
    ).toBe(1);
    expect(fixture.nativeElement.querySelector('mat-card')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-section="cards"] form'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.slsp-section__description'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.add-card-form__heading'),
    ).toBeNull();
  });

  it('confirms and removes the exact displayed card by element reference', () => {
    api.removeLibraryCardNumber.and.returnValue(of(updatedPatron));

    component.remove(removableCard);

    expect(dialog.open).toHaveBeenCalledOnceWith(
      ConfirmationdialogComponent,
      jasmine.objectContaining({
        data: { confirmMessage: 'Remove this exact number?' },
      }),
    );
    expect(api.removeLibraryCardNumber).toHaveBeenCalledOnceWith(
      'patron-1',
      'card-reference',
    );
    expect(state.replacePatron).toHaveBeenCalledOnceWith(
      updatedPatron,
      context,
    );
    expect(alert.success).toHaveBeenCalledOnceWith('Card removed', {
      autoClose: true,
      delay: 5000,
    });
  });

  it('does not remove a non-removable DTO or mutate without a current context', () => {
    component.remove(aliasCard);
    state.currentMutationContext.and.returnValue(null);
    component.remove(removableCard);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(api.removeLibraryCardNumber).not.toHaveBeenCalled();
  });

  it('does not combine an element reference with a context selected while confirmation is open', () => {
    const confirmation$ = new Subject<boolean>();
    const changedContext = {
      patronId: 'patron-2',
    } as PatronMutationContext;

    dialogRef.afterClosed.and.returnValue(confirmation$);
    api.removeLibraryCardNumber.and.returnValue(of(updatedPatron));

    component.remove(removableCard);
    state.currentMutationContext.and.returnValue(changedContext);
    confirmation$.next(true);
    confirmation$.complete();

    expect(api.removeLibraryCardNumber).not.toHaveBeenCalled();
    expect(state.replacePatron).not.toHaveBeenCalled();
  });

  it('sends the entered value, replaces state, and resets the form on success', () => {
    const formDirective = jasmine.createSpyObj<FormGroupDirective>(
      'FormGroupDirective',
      ['resetForm'],
    );

    api.addLibraryCardNumber.and.returnValue(of(updatedPatron));
    component.numberForm.setValue({ newLibraryCardNumber: '  NEW-CARD  ' });

    component.add(formDirective);

    expect(api.addLibraryCardNumber).toHaveBeenCalledOnceWith(
      'patron-1',
      'NEW-CARD',
    );
    expect(state.replacePatron).toHaveBeenCalledOnceWith(
      updatedPatron,
      context,
    );
    expect(formDirective.resetForm).toHaveBeenCalledTimes(1);
    expect(component.numberForm.value.newLibraryCardNumber).toBeNull();
    expect(alert.success).toHaveBeenCalledOnceWith('Card added', {
      autoClose: true,
      delay: 5000,
    });
  });

  it('rejects blank card input and prevents a duplicate submit while loading', () => {
    const response$ = new Subject<CardPatron>();
    const formDirective = jasmine.createSpyObj<FormGroupDirective>(
      'FormGroupDirective',
      ['resetForm'],
    );

    api.addLibraryCardNumber.and.returnValue(response$);
    component.numberForm.setValue({ newLibraryCardNumber: '   ' });
    component.add(formDirective);
    component.numberForm.setValue({ newLibraryCardNumber: 'NEW-CARD' });
    component.add(formDirective);
    component.add(formDirective);

    expect(api.addLibraryCardNumber).toHaveBeenCalledTimes(1);
    expect(component.loading).toBeTrue();

    response$.next(updatedPatron);
    response$.complete();

    expect(component.loading).toBeFalse();
  });

  it('uses a generic safe error and always releases loading for an unknown failure', () => {
    api.addLibraryCardNumber.and.returnValue(
      throwError(() => new Error('backend detail must not render')),
    );
    component.numberForm.setValue({ newLibraryCardNumber: 'NEW-CARD' });

    component.add(
      jasmine.createSpyObj<FormGroupDirective>('FormGroupDirective', [
        'resetForm',
      ]),
    );

    expect(alert.error).toHaveBeenCalledOnceWith(
      'An unexpected error occurred.',
      {
        autoClose: false,
      },
    );
    expect(alert.error.calls.mostRecent().args[0]).not.toContain(
      'backend detail must not render',
    );
    expect(state.replacePatron).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });

  it('presents a duplicate-card backend conflict as a warning with its support id', () => {
    api.addLibraryCardNumber.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              type: 'DUPLICATE_LIBRARY_CARD_NUMBER',
              errorId: 'support-card-409',
              context: { detail: 'private backend detail' },
            },
          }),
      ),
    );
    component.numberForm.setValue({ newLibraryCardNumber: 'NEW-CARD' });

    component.add(
      jasmine.createSpyObj<FormGroupDirective>('FormGroupDirective', [
        'resetForm',
      ]),
    );

    expect(alert.warn).toHaveBeenCalledOnceWith(
      'This card number is already in use. Support ID: support-card-409',
      { autoClose: false },
    );
    expect(alert.error).not.toHaveBeenCalled();
    expect(state.replacePatron).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });
});
