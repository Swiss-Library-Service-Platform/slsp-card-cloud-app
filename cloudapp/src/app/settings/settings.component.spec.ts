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
import { CardPatron, PostalAddressView } from '../models/card-api.model';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let alert: jasmine.SpyObj<AlertService>;
  let api: jasmine.SpyObj<PatronApiService>;
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let patronState$: BehaviorSubject<PatronState>;
  let state: jasmine.SpyObj<PatronStateService>;
  const selected: Entity = {
    id: 'patron-1',
    type: EntityType.USER,
    link: '/users/patron-1',
    description: 'Selected patron',
  };
  const context = { patronId: 'patron-1' } as PatronMutationContext;
  const preferred: PostalAddressView = {
    elementReference: 'preferred-reference',
    types: ['home', 'billing'],
    line1: 'Main Street 1',
    postalCode: '8000',
    city: 'Zurich',
    country: 'Switzerland',
    preferred: true,
  };
  const selectable: PostalAddressView = {
    elementReference: 'selectable-reference',
    types: ['work'],
    line1: null,
    postalCode: null,
    city: 'Bern',
    country: null,
    preferred: false,
  };
  const presentationOnly: PostalAddressView = {
    elementReference: null,
    types: ['other'],
    line1: 'Unselectable 3',
    postalCode: '1000',
    city: 'Lausanne',
    country: 'Switzerland',
    preferred: false,
  };
  const patron: CardPatron = {
    fullName: 'Test Patron',
    external: false,
    libraryCardNumbers: [],
    matriculationNumber: null,
    dashedMatriculationNumber: null,
    blocks: {},
    postalAddresses: [preferred, selectable, presentationOnly],
  };
  const updatedPatron: CardPatron = {
    ...patron,
    postalAddresses: [
      { ...preferred, preferred: false },
      { ...selectable, preferred: true },
      presentationOnly,
    ],
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
      'setPreferredAddress',
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
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      Settings: {
        PreferredAddress: 'Preferred address',
        PreferredAddressDescription: 'Description',
        PreferredAddressDescriptionLink: 'edu-ID',
        MoreInformation: 'More information',
        AddressType: 'Address Type',
        UseAsPreferred: 'Use as preferred address',
        NoAddresses: 'No addresses',
        SetError: 'Address change failed',
        SetSuccess: 'Address changed',
        Preferred: 'Preferred',
        InvoiceContacts: 'Invoice contact details',
        InvoiceContactsDescription:
          'Invoice portal and email will appear here.',
        UserGroup: 'User group',
        UserGroupDescription:
          'Eligibility is provided by registration-platform.',
      },
      Errors: {
        InvalidSettingsNote: 'The shared settings are invalid.',
        UnexpectedFailure: 'An unexpected error occurred.',
        SelectedPatron: 'The selected patron',
        SupportId: 'Support ID: {{errorId}}',
      },
    });
    translate.use('en');

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders presentation-only typed address fields and nulls safely', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('home, billing');
    expect(text).toContain('Main Street 1, 8000, Zurich, Switzerland');
    expect(text).toContain('work');
    expect(text).toContain('Bern');
    expect(text).toContain('Unselectable 3, 1000, Lausanne, Switzerland');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });

  it('does not expose an enabled action for the preferred or selectorless address', () => {
    const cards = fixture.nativeElement.querySelectorAll(
      '[data-address]',
    ) as NodeListOf<HTMLElement>;
    const preferredButton = cards[0].querySelector(
      '[data-action="prefer"]',
    ) as HTMLButtonElement | null;
    const selectableButton = cards[1].querySelector(
      '[data-action="prefer"]',
    ) as HTMLButtonElement | null;
    const presentationButton = cards[2].querySelector(
      '[data-action="prefer"]',
    ) as HTMLButtonElement | null;

    expect(preferredButton?.disabled ?? true).toBeTrue();
    expect(selectableButton?.disabled).toBeFalse();
    expect(presentationButton?.disabled ?? true).toBeTrue();
  });

  it('renders collapsed information for all Account sections', () => {
    const informationButtons = fixture.nativeElement.querySelectorAll(
      '[data-info]',
    ) as NodeListOf<HTMLButtonElement>;

    expect(informationButtons.length).toBe(3);
    expect(
      Array.from(informationButtons).every(
        (button) => button.getAttribute('aria-expanded') === 'false',
      ),
    ).toBeTrue();
    expect(fixture.nativeElement.textContent).not.toContain('Description');
    expect(fixture.nativeElement.textContent).not.toContain(
      'registration-platform',
    );
  });

  it('reveals each section information panel on request', () => {
    const preferredAddress = fixture.nativeElement.querySelector(
      '[data-section="preferred-address"]',
    ) as HTMLElement;
    const invoice = fixture.nativeElement.querySelector(
      '[data-placeholder="invoice-contacts"]',
    ) as HTMLElement;
    const userGroup = fixture.nativeElement.querySelector(
      '[data-placeholder="user-group"]',
    ) as HTMLElement;

    preferredAddress.querySelector<HTMLButtonElement>('[data-info]')?.click();
    invoice.querySelector<HTMLButtonElement>('[data-info]')?.click();
    userGroup.querySelector<HTMLButtonElement>('[data-info]')?.click();
    fixture.detectChanges();

    expect(preferredAddress.textContent).toContain('Description');
    expect(invoice.textContent).toContain('Invoice portal and email');
    expect(userGroup.textContent).toContain('registration-platform');
    expect(invoice.querySelector('input, select, textarea')).toBeNull();
    expect(userGroup.querySelector('input, select, textarea')).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-card')).toBeNull();
  });

  it('sends the selected address element reference and replaces refreshed state', () => {
    api.setPreferredAddress.and.returnValue(of(updatedPatron));

    component.changePreferredAddress(selectable);

    expect(api.setPreferredAddress).toHaveBeenCalledOnceWith(
      'patron-1',
      'selectable-reference',
    );
    expect(state.replacePatron).toHaveBeenCalledOnceWith(
      updatedPatron,
      context,
    );
    expect(alert.success).toHaveBeenCalledOnceWith('Address changed', {
      autoClose: false,
    });
  });

  it('does not mutate preferred, selectorless, contextless, or duplicate actions', () => {
    const response$ = new Subject<CardPatron>();

    api.setPreferredAddress.and.returnValue(response$);
    component.changePreferredAddress(preferred);
    component.changePreferredAddress(presentationOnly);
    component.changePreferredAddress(selectable);
    component.changePreferredAddress(selectable);

    expect(api.setPreferredAddress).toHaveBeenCalledTimes(1);

    response$.next(updatedPatron);
    response$.complete();
    state.currentMutationContext.and.returnValue(null);
    component.changePreferredAddress(selectable);

    expect(api.setPreferredAddress).toHaveBeenCalledTimes(1);
    expect(component.loading).toBeFalse();
  });

  it('uses a generic safe error for an unknown failure without replacing state', () => {
    api.setPreferredAddress.and.returnValue(
      throwError(() => new Error('private backend detail')),
    );

    component.changePreferredAddress(selectable);

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

  it('presents invalid shared settings as a warning with its support id', () => {
    api.setPreferredAddress.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              type: 'INVALID_SETTINGS_NOTE',
              errorId: 'support-settings-409',
              context: { detail: 'private backend detail' },
            },
          }),
      ),
    );

    component.changePreferredAddress(selectable);

    expect(alert.warn).toHaveBeenCalledOnceWith(
      'The shared settings are invalid. Support ID: support-settings-409',
      { autoClose: false },
    );
    expect(alert.error).not.toHaveBeenCalled();
    expect(state.replacePatron).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });
});
