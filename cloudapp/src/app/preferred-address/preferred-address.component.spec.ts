import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AppModule } from '../app.module';
import { CardPatron, PostalAddressView } from '../models/card-api.model';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronStateService,
} from '../services/patron-state.service';
import { PreferredAddressComponent } from './preferred-address.component';

describe('PreferredAddressComponent', () => {
  let api: jasmine.SpyObj<PatronApiService>;
  let fixture: ComponentFixture<PreferredAddressComponent>;
  let state: jasmine.SpyObj<PatronStateService>;
  const context = { patronId: 'patron-1' } as PatronMutationContext;
  const preferred: PostalAddressView = {
    elementReference: 'preferred-reference',
    types: ['home'],
    line1: 'Main Street 1',
    postalCode: '8000',
    city: 'Zürich',
    country: 'Switzerland',
    preferred: true,
  };
  const alternative: PostalAddressView = {
    ...preferred,
    elementReference: 'alternative-reference',
    types: ['work'],
    city: 'Bern',
    preferred: false,
  };
  const patron: CardPatron = {
    fullName: 'Test Patron',
    external: false,
    libraryCardNumbers: [],
    matriculationNumber: null,
    dashedMatriculationNumber: null,
    blocks: {},
    postalAddresses: [preferred, alternative],
    preferredEmailAddress: null,
    invoicePostalAddress: null,
    invoiceEmailAddress: null,
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PatronApiService>('PatronApiService', [
      'setPreferredAddress',
    ]);
    state = jasmine.createSpyObj<PatronStateService>('PatronStateService', [
      'currentMutationContext',
      'replacePatron',
    ]);
    state.currentMutationContext.and.returnValue(context);

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: PatronApiService, useValue: api },
        { provide: PatronStateService, useValue: state },
        {
          provide: AlertService,
          useValue: jasmine.createSpyObj('AlertService', [
            'success',
            'warn',
            'error',
          ]),
        },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      Settings: {
        PreferredAddress: 'Preferred address',
        PreferredAddressDescription: 'Description',
        PreferredAddressDescriptionLink: 'edu-ID',
        MoreInformation: 'More information',
        AddressType: 'Address type',
        Preferred: 'Preferred',
        UseAsPreferred: 'Use as preferred',
        NoAddresses: 'No addresses',
        SetSuccess: 'Address changed',
      },
    });
    translate.use('en');

    fixture = TestBed.createComponent(PreferredAddressComponent);
    fixture.componentRef.setInput('patron', patron);
    fixture.detectChanges();
  });

  it('preserves the existing address presentation and selector guards', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-address]');

    expect(fixture.nativeElement.textContent).toContain('Main Street 1');
    expect(rows.length).toBe(2);
    expect(rows[0].classList).not.toContain('address-row--preferred');
    expect(rows[0].querySelector('.slsp-status').textContent).toContain(
      'Preferred',
    );
    expect(rows[0].querySelector('[data-action="prefer"]')).toBeNull();
    expect(
      (rows[1].querySelector('[data-action="prefer"]') as HTMLButtonElement)
        .disabled,
    ).toBeFalse();
  });

  it('presents missing addresses as muted text without an icon', () => {
    fixture.componentRef.setInput('patron', {
      ...patron,
      postalAddresses: [],
    });
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector(
      '.slsp-empty-state',
    ) as HTMLElement;

    expect(emptyState.textContent).toContain('No addresses');
    expect(emptyState.querySelector('mat-icon')).toBeNull();
  });

  it('emits the shared busy state and replaces patron state from the response', () => {
    const updated = {
      ...patron,
      postalAddresses: [
        { ...preferred, preferred: false },
        { ...alternative, preferred: true },
      ],
    };
    const busy: boolean[] = [];

    fixture.componentInstance.busyChange.subscribe((value) => busy.push(value));
    api.setPreferredAddress.and.returnValue(of(updated));

    fixture.componentInstance.changePreferredAddress(alternative);

    expect(api.setPreferredAddress).toHaveBeenCalledOnceWith(
      'patron-1',
      'alternative-reference',
    );
    expect(state.replacePatron).toHaveBeenCalledOnceWith(updated, context);
    expect(busy).toEqual([true, false]);
  });
});
