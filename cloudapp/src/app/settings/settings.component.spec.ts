import { Location } from '@angular/common';
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
    selector: 'preferred-selector',
    types: ['home', 'billing'],
    line1: 'Main Street 1',
    postalCode: '8000',
    city: 'Zurich',
    country: 'Switzerland',
    preferred: true,
  };
  const selectable: PostalAddressView = {
    selector: 'selectable-selector',
    types: ['work'],
    line1: null,
    postalCode: null,
    city: 'Bern',
    country: null,
    preferred: false,
  };
  const presentationOnly: PostalAddressView = {
    selector: null,
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
      Settings: {
        PreferredAddress: 'Preferred address',
        PreferredAddressDescription: 'Description',
        PreferredAddressDescriptionLink: 'edu-ID',
        AddressType: 'Address Type',
        Address: 'Address',
        UseAsPreferred: 'Use as preferred address',
        NoAddresses: 'No addresses',
        SetError: 'Address change failed',
        SetSuccess: 'Address changed',
      },
      General: { BackToMenu: 'Back' },
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

  it('sends the selected address selector and replaces refreshed state', () => {
    api.setPreferredAddress.and.returnValue(of(updatedPatron));

    component.changePreferredAddress(selectable);

    expect(api.setPreferredAddress).toHaveBeenCalledOnceWith(
      'patron-1',
      'selectable-selector',
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

  it('reports backend failures without replacing state', () => {
    api.setPreferredAddress.and.returnValue(
      throwError(() => new Error('private backend detail')),
    );

    component.changePreferredAddress(selectable);

    expect(alert.error).toHaveBeenCalledOnceWith('Address change failed', {
      autoClose: false,
    });
    expect(state.replacePatron).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });
});
