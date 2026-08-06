import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AlertService,
  Entity,
  EntityType,
} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { AppModule } from '../app.module';
import {
  AddableBlockCode,
  BlockView,
  CardPatron,
} from '../models/card-api.model';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';
import { BlockComponent } from './block.component';

describe('BlockComponent', () => {
  let alert: jasmine.SpyObj<AlertService>;
  let api: jasmine.SpyObj<PatronApiService>;
  let component: BlockComponent;
  let fixture: ComponentFixture<BlockComponent>;
  let patronState$: BehaviorSubject<PatronState>;
  let state: jasmine.SpyObj<PatronStateService>;
  const selected: Entity = {
    id: 'patron-1',
    type: EntityType.USER,
    link: '/users/patron-1',
    description: 'Selected patron',
  };
  const context = { patronId: 'patron-1' } as PatronMutationContext;
  const block = (
    code: BlockView['code'],
    elementReference = `${code}-reference`,
  ): BlockView => ({
    code,
    createdDate: '2026-08-01T12:00:00Z',
    expiryDate: null,
    note: `note-${code}`,
    elementReference,
  });
  const allBlocks: CardPatron['blocks'] = {
    '02': block('02'),
    '03': block('03'),
    '03.1': block('03.1'),
    '09': block('09'),
    '08': block('08'),
  };
  const patron = (external: boolean, blocks = allBlocks): CardPatron => ({
    fullName: 'Test Patron',
    external,
    libraryCardNumbers: [],
    matriculationNumber: null,
    dashedMatriculationNumber: null,
    blocks,
    postalAddresses: [],
  });
  const updatedPatron = patron(false, { '03': block('03', 'fresh') });

  beforeEach(async () => {
    patronState$ = new BehaviorSubject<PatronState>({
      status: 'ready',
      entity: selected,
      patron: patron(true),
    });
    state = jasmine.createSpyObj<PatronStateService>(
      'PatronStateService',
      ['currentMutationContext', 'replacePatron'],
      { patronState$ },
    );
    state.currentMutationContext.and.returnValue(context);
    api = jasmine.createSpyObj<PatronApiService>('PatronApiService', [
      'addBlock',
      'removeBlock',
    ]);
    alert = jasmine.createSpyObj<AlertService>('AlertService', [
      'error',
      'success',
      'warn',
    ]);

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: PatronApiService, useValue: api },
        { provide: PatronStateService, useValue: state },
        { provide: AlertService, useValue: alert },
        {
          provide: Location,
          useValue: jasmine.createSpyObj<Location>('Location', ['back']),
        },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      Blocks: {
        Status: 'Status:',
        ExistingBlocks: 'Account is blocked!',
        NoBlocks: 'User has no blocks.',
        DoubleRegistrations: 'Double Registration',
        WrongAddress: 'Wrong Postal Address',
        WrongEmail: 'Wrong E-mail',
        GlobalBlock: 'Global block',
        NewAccount: 'New Account',
        DoubleRegistrationsDescription: 'Double guidance',
        WrongAddressDescription: 'Address guidance',
        WrongEmailDescription: 'Email guidance',
        GlobalBlockDescription: 'Global guidance',
        NewAccountDescription: 'New account guidance',
        CreatedOn: 'Created on:',
        ExpiringOn: 'Expiring on:',
        NoExpiringDate: 'Not expiring',
        Note: 'Note',
        GlobalBlockNote: 'Reason for blocking',
        RemoveBlock: 'Remove Block',
        AddBlock: 'Add Block',
        Comment: 'Comment',
        'address-block-external-info': 'External address guidance',
        'address-block-internal-info': 'Internal address guidance',
        'email-block-external-info': 'External email guidance',
        'email-block-internal-info': 'Internal email guidance',
        AddError: 'Block addition failed',
        AddSuccess: 'Block added',
        RemoveError: 'Block removal failed',
        RemoveSuccess: 'Block removed',
      },
      General: { BackToMenu: 'Back' },
      Errors: {
        DependencyUnavailable: 'Service temporarily unavailable.',
        UnexpectedFailure: 'An unexpected error occurred.',
        SelectedPatron: 'The selected patron',
        SupportId: 'Support ID: {{errorId}}',
      },
    });
    translate.use('en');

    fixture = TestBed.createComponent(BlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders all five typed block slots and never offers add for code 08', () => {
    const text = fixture.nativeElement.textContent as string;
    const code08 = fixture.nativeElement.querySelector(
      '[data-block-code="08"]',
    ) as HTMLElement;

    expect(text).toContain('Double Registration');
    expect(text).toContain('Wrong Postal Address');
    expect(text).toContain('Wrong E-mail');
    expect(text).toContain('Global block');
    expect(text).toContain('New Account');
    expect(code08.querySelector('[data-action="add"]')).toBeNull();
    expect(code08.querySelector('[data-action="remove"]')).not.toBeNull();
  });

  it('renders external and internal DTO guidance without a browser User model', () => {
    let text = fixture.nativeElement.textContent as string;

    expect(text).toContain('External address guidance');
    expect(text).toContain('External email guidance');
    expect(text).not.toContain('Internal address guidance');

    patronState$.next({
      status: 'ready',
      entity: selected,
      patron: patron(false),
    });
    fixture.detectChanges();
    text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Internal address guidance');
    expect(text).toContain('Internal email guidance');
    expect(text).not.toContain('External address guidance');
  });

  it('requires a nonblank global comment in both presentation and action', () => {
    patronState$.next({
      status: 'ready',
      entity: selected,
      patron: patron(false, {}),
    });
    fixture.detectChanges();

    const globalButton = fixture.nativeElement.querySelector(
      '[data-block-code="09"] [data-action="add"]',
    ) as HTMLButtonElement;

    expect(globalButton.disabled).toBeTrue();

    component.add('09', '   ');

    expect(api.addBlock).not.toHaveBeenCalled();
  });

  it('adds an allowed block, trims its comment, and replaces refreshed state', () => {
    api.addBlock.and.returnValue(of(updatedPatron));

    component.add('03' satisfies AddableBlockCode, '  returned mail  ');

    expect(api.addBlock).toHaveBeenCalledOnceWith(
      'patron-1',
      '03',
      'returned mail',
    );
    expect(state.replacePatron).toHaveBeenCalledOnceWith(
      updatedPatron,
      context,
    );
    expect(alert.success).toHaveBeenCalledOnceWith('Block added', {
      autoClose: false,
    });
  });

  it('removes the exact displayed block by element reference and replaces refreshed state', () => {
    const displayed = block('03', 'opaque-block-reference');

    api.removeBlock.and.returnValue(of(updatedPatron));

    component.remove(displayed);

    expect(api.removeBlock).toHaveBeenCalledOnceWith(
      'patron-1',
      'opaque-block-reference',
    );
    expect(state.replacePatron).toHaveBeenCalledOnceWith(
      updatedPatron,
      context,
    );
  });

  it('does not mutate without a context or issue duplicate requests while loading', () => {
    const response$ = new Subject<CardPatron>();

    api.addBlock.and.returnValue(response$);
    component.add('02', 'one');
    component.add('02', 'two');

    expect(api.addBlock).toHaveBeenCalledTimes(1);

    response$.next(updatedPatron);
    response$.complete();
    state.currentMutationContext.and.returnValue(null);
    component.remove(block('02'));

    expect(api.removeBlock).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });

  it('uses a generic safe error for an unknown failure without replacing state', () => {
    api.removeBlock.and.returnValue(
      throwError(() => new Error('private backend detail')),
    );

    component.remove(block('02'));

    expect(alert.error).toHaveBeenCalledOnceWith(
      'An unexpected error occurred.',
      { autoClose: false },
    );
    expect(alert.error.calls.mostRecent().args[0]).not.toContain(
      'private backend detail',
    );
    expect(state.replacePatron).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });

  it('presents a typed dependency failure as temporary-unavailable with its support id', () => {
    api.removeBlock.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            error: {
              type: 'DEPENDENCY_UNAVAILABLE',
              errorId: 'support-block-503',
              context: {},
            },
          }),
      ),
    );

    component.remove(block('02'));

    expect(alert.error).toHaveBeenCalledOnceWith(
      'Service temporarily unavailable. Support ID: support-block-503',
      { autoClose: false },
    );
    expect(state.replacePatron).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });
});
