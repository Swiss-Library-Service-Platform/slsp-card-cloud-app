import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  AlertService,
  Entity,
  EntityType,
} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';

import { AppModule } from '../app.module';
import { InvoiceContactsComponent } from '../invoice-contacts/invoice-contacts.component';
import { InvoicePostalAddressComponent } from '../invoice-contacts/invoice-postal-address.component';
import { CardPatron } from '../models/card-api.model';
import { PreferredAddressComponent } from '../preferred-address/preferred-address.component';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let api: jasmine.SpyObj<PatronApiService>;
  let fixture: ComponentFixture<SettingsComponent>;
  let state: jasmine.SpyObj<PatronStateService>;
  const context = { patronId: 'patron-1' } as PatronMutationContext;
  const entity: Entity = {
    id: 'patron-1',
    type: EntityType.USER,
    link: '/users/patron-1',
    description: 'Selected patron',
  };
  const patron: CardPatron = {
    fullName: 'Test Patron',
    external: false,
    libraryCardNumbers: [],
    matriculationNumber: null,
    dashedMatriculationNumber: null,
    blocks: {},
    postalAddresses: [
      {
        elementReference: 'preferred-reference',
        types: ['home'],
        line1: 'Home Street 1',
        postalCode: '8000',
        city: 'Zürich',
        country: 'Switzerland',
        preferred: true,
      },
      {
        elementReference: 'alternative-reference',
        types: ['work'],
        line1: 'Work Street 2',
        postalCode: '3000',
        city: 'Bern',
        country: 'Switzerland',
        preferred: false,
      },
    ],
    preferredEmailAddress: null,
    invoicePostalAddress: null,
    invoiceEmailAddress: null,
  };

  beforeEach(async () => {
    const patronState$ = new BehaviorSubject<PatronState>({
      status: 'ready',
      entity,
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
      'setInvoicePostalAddress',
      'removeInvoicePostalAddress',
      'setInvoiceEmailAddress',
      'removeInvoiceEmailAddress',
    ]);

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: PatronStateService, useValue: state },
        { provide: PatronApiService, useValue: api },
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
        InvoiceContacts: 'Invoice contact details',
        InvoiceContactsDescription: 'Independent invoice contacts',
        MoreInformation: 'More information',
        NotAvailableYet: 'Not available yet',
        UserGroup: 'User group',
        UserGroupDescription: 'User group description',
      },
    });
    translate.use('en');

    fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
  });

  it('composes preferred address and live invoice contacts while retaining only the user-group placeholder', () => {
    expect(
      fixture.debugElement.query(By.directive(PreferredAddressComponent)),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.directive(InvoiceContactsComponent)),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-section="invoice-contacts"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector(
        '[data-placeholder="invoice-contacts"]',
      ),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-placeholder="user-group"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(
      'Invoice contact details',
    );
  });

  it('coordinates one shared Account mutation busy state', () => {
    const preferred = fixture.debugElement.query(
      By.directive(PreferredAddressComponent),
    ).componentInstance as PreferredAddressComponent;
    const postal = fixture.debugElement.query(
      By.directive(InvoicePostalAddressComponent),
    ).componentInstance as InvoicePostalAddressComponent;

    postal.busyChange.emit(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.mutationBusy).toBeTrue();
    expect(preferred.disabled).toBeTrue();
    expect(postal.disabled).toBeTrue();
    expect(postal.form.disabled).toBeTrue();

    postal.busyChange.emit(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.mutationBusy).toBeFalse();
  });

  it('renders one shared loading spinner during a preferred-address mutation', () => {
    const preferred = fixture.debugElement.query(
      By.directive(PreferredAddressComponent),
    ).componentInstance as PreferredAddressComponent;
    const response = new Subject<CardPatron>();

    api.setPreferredAddress.and.returnValue(response);
    preferred.changePreferredAddress(patron.postalAddresses[1]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.loading-shade')).toHaveSize(
      1,
    );
    expect(fixture.nativeElement.querySelectorAll('mat-spinner')).toHaveSize(1);

    response.next(patron);
    response.complete();
  });

  it('keeps all three Account information panels collapsed initially', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      '[data-info]',
    ) as NodeListOf<HTMLButtonElement>;

    expect(buttons.length).toBe(3);
    expect(
      Array.from(buttons).every(
        (button) => button.getAttribute('aria-expanded') === 'false',
      ),
    ).toBeTrue();
  });
});
