import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { AppModule } from '../app.module';
import { CardPatron } from '../models/card-api.model';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronStateService,
} from '../services/patron-state.service';
import { InvoiceEmailAddressComponent } from './invoice-email-address.component';

describe('InvoiceEmailAddressComponent', () => {
  let api: jasmine.SpyObj<PatronApiService>;
  let fixture: ComponentFixture<InvoiceEmailAddressComponent>;
  let state: jasmine.SpyObj<PatronStateService>;
  const context = { patronId: 'patron-1' } as PatronMutationContext;
  const patron: CardPatron = {
    fullName: 'Test Patron',
    external: false,
    libraryCardNumbers: [],
    matriculationNumber: null,
    dashedMatriculationNumber: null,
    blocks: {},
    postalAddresses: [],
    preferredEmailAddress: 'preferred@example.org',
    invoicePostalAddress: null,
    invoiceEmailAddress: null,
  };
  const customPatron: CardPatron = {
    ...patron,
    invoiceEmailAddress: {
      elementReference: 'email-reference',
      emailAddress: 'invoice@example.org',
    },
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PatronApiService>('PatronApiService', [
      'setInvoiceEmailAddress',
      'removeInvoiceEmailAddress',
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
      General: { Cancel: 'Cancel' },
      Settings: {
        EmailAddress: 'E-mail address',
        UsePreferredEmailAddress: 'Use preferred e-mail address',
        UseCustomEmailAddress: 'Use a different e-mail address',
        PreferredEmailAddressMissing: 'No preferred e-mail address',
        InvalidEmail: 'Enter a valid e-mail address',
        SaveEmailAddress: 'Save e-mail address',
        InvoiceEmailSetSuccess: 'E-mail saved',
        InvoiceEmailRemoveSuccess: 'E-mail removed',
      },
    });
    translate.use('en');
  });

  it('creates a trimmed custom e-mail with a null freshness reference', () => {
    create(patron);
    api.setInvoiceEmailAddress.and.returnValue(of(customPatron));
    fixture.componentInstance.form.controls.source.setValue('custom');
    fixture.componentInstance.form.controls.emailAddress.setValue(
      ' invoice@example.org ',
    );

    fixture.componentInstance.save();

    expect(api.setInvoiceEmailAddress).toHaveBeenCalledOnceWith('patron-1', {
      elementReference: null,
      emailAddress: 'invoice@example.org',
    });
    expect(state.replacePatron).toHaveBeenCalledOnceWith(customPatron, context);
  });

  it('groups the preferred value with its radio and omits a status chip', () => {
    create(patron);

    expect(
      fixture.nativeElement.querySelector(
        '[data-source-option="preferred"] .invoice-editor__preferred-value',
      ).textContent,
    ).toContain('preferred@example.org');
    expect(
      fixture.nativeElement.querySelector(
        '.invoice-editor__heading .slsp-status',
      ),
    ).toBeNull();
  });

  it('removes a custom e-mail by selecting preferred and saving', () => {
    create(customPatron);
    api.removeInvoiceEmailAddress.and.returnValue(of(patron));
    fixture.componentInstance.form.controls.source.setValue('preferred');

    fixture.componentInstance.save();

    expect(api.removeInvoiceEmailAddress).toHaveBeenCalledOnceWith(
      'patron-1',
      'email-reference',
    );
  });

  it('replaces with the confirmed reference and resets to the confirmed response', () => {
    create(customPatron);

    const updated = {
      ...customPatron,
      invoiceEmailAddress: {
        elementReference: 'email-reference',
        emailAddress: 'updated@example.org',
      },
    };

    api.setInvoiceEmailAddress.and.returnValue(of(updated));
    fixture.componentInstance.form.controls.emailAddress.setValue(
      ' updated@example.org ',
    );
    fixture.componentInstance.save();

    expect(api.setInvoiceEmailAddress).toHaveBeenCalledOnceWith('patron-1', {
      elementReference: 'email-reference',
      emailAddress: 'updated@example.org',
    });
    expect(fixture.componentInstance.form.controls.emailAddress.value).toBe(
      'updated@example.org',
    );
    expect(fixture.componentInstance.form.pristine).toBeTrue();
  });

  it('makes no request for unchanged custom e-mail data', () => {
    create(customPatron);

    fixture.componentInstance.save();

    expect(api.setInvoiceEmailAddress).not.toHaveBeenCalled();
    expect(api.removeInvoiceEmailAddress).not.toHaveBeenCalled();
  });

  it('defaults to custom when no preferred e-mail exists', () => {
    create({ ...patron, preferredEmailAddress: null });

    expect(fixture.componentInstance.form.controls.source.value).toBe('custom');
    expect(
      (
        fixture.nativeElement.querySelector(
          '[data-source="preferred"] input',
        ) as HTMLInputElement
      ).disabled,
    ).toBeTrue();
    expect(
      fixture.nativeElement.querySelector(
        '[data-source-option="preferred"] .invoice-editor__missing',
      ).textContent,
    ).toContain('No preferred e-mail address');
  });

  it('keeps removal unavailable when a custom e-mail has no preferred fallback', () => {
    create({ ...customPatron, preferredEmailAddress: null });

    const preferredRadio = fixture.nativeElement.querySelector(
      '[data-source="preferred"] input',
    ) as HTMLInputElement;

    expect(preferredRadio.disabled).toBeTrue();
    fixture.componentInstance.form.controls.source.setValue('preferred');
    fixture.componentInstance.save();
    expect(api.removeInvoiceEmailAddress).not.toHaveBeenCalled();
  });

  it('enables cancel only while the form has unsaved changes', () => {
    create(customPatron);

    const cancel = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-action="cancel"]');

    expect(cancel().disabled).toBeTrue();

    fixture.componentInstance.form.markAsDirty();
    fixture.detectChanges();
    expect(cancel().disabled).toBeFalse();

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(cancel().disabled).toBeTrue();
  });

  it('retains dirty e-mail input after an API failure', () => {
    create(customPatron);
    api.setInvoiceEmailAddress.and.returnValue(
      throwError(() => new Error('private upstream detail')),
    );
    fixture.componentInstance.form.controls.emailAddress.setValue(
      'retry@example.org',
    );

    fixture.componentInstance.save();

    expect(fixture.componentInstance.form.controls.emailAddress.value).toBe(
      'retry@example.org',
    );
    expect(state.replacePatron).not.toHaveBeenCalled();
  });

  it('disables the complete form while a request is active', () => {
    create(customPatron);

    const response = new Subject<CardPatron>();

    api.setInvoiceEmailAddress.and.returnValue(response);
    fixture.componentInstance.form.controls.emailAddress.setValue(
      'updated@example.org',
    );
    fixture.componentInstance.save();

    expect(fixture.componentInstance.form.disabled).toBeTrue();

    response.next(customPatron);
    response.complete();
    expect(fixture.componentInstance.form.enabled).toBeTrue();
    expect(
      fixture.componentInstance.form.controls.emailAddress.enabled,
    ).toBeTrue();
  });

  it('rejects backend-incompatible e-mail syntax without an API call', () => {
    create(customPatron);
    fixture.componentInstance.form.controls.emailAddress.setValue(
      'invalid@example',
    );

    fixture.componentInstance.save();

    expect(api.setInvoiceEmailAddress).not.toHaveBeenCalled();
  });

  it('keeps dirty e-mail input after a postal-only patron refresh', () => {
    create(customPatron);
    fixture.componentInstance.form.controls.emailAddress.setValue(
      'dirty@example.org',
    );
    fixture.componentRef.setInput('patron', {
      ...customPatron,
      invoicePostalAddress: {
        elementReference: 'postal-reference',
        line1: 'Billing AG',
        line2: null,
        line3: null,
        line4: null,
        postalCode: '8000',
        city: 'Zürich',
        countryCode: 'CHE',
      },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.emailAddress.value).toBe(
      'dirty@example.org',
    );
  });

  it('resets dirty input when the selected patron changes with identical contacts', () => {
    create(customPatron);
    fixture.componentInstance.form.controls.emailAddress.setValue(
      'dirty@example.org',
    );
    fixture.componentInstance.form.markAsDirty();
    state.currentMutationContext.and.returnValue({
      patronId: 'patron-2',
    } as PatronMutationContext);
    fixture.componentRef.setInput('patron', { ...customPatron });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.emailAddress.value).toBe(
      'invoice@example.org',
    );
    expect(fixture.componentInstance.form.pristine).toBeTrue();
  });

  function create(value: CardPatron): void {
    fixture = TestBed.createComponent(InvoiceEmailAddressComponent);
    fixture.componentRef.setInput('patron', value);
    fixture.detectChanges();
  }
});
