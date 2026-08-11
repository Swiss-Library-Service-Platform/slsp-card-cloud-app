import { HttpErrorResponse } from '@angular/common/http';
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
import { InvoicePostalAddressComponent } from './invoice-postal-address.component';

describe('InvoicePostalAddressComponent', () => {
  let alert: jasmine.SpyObj<AlertService>;
  let api: jasmine.SpyObj<PatronApiService>;
  let fixture: ComponentFixture<InvoicePostalAddressComponent>;
  let state: jasmine.SpyObj<PatronStateService>;
  const context = { patronId: 'patron-1' } as PatronMutationContext;
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
    ],
    preferredEmailAddress: 'preferred@example.org',
    invoicePostalAddress: null,
    invoiceEmailAddress: null,
  };
  const customPatron: CardPatron = {
    ...patron,
    invoicePostalAddress: {
      elementReference: 'postal-reference',
      line1: 'Billing AG',
      line2: null,
      line3: null,
      line4: null,
      postalCode: '3000',
      city: 'Bern',
      countryCode: 'CHE',
    },
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PatronApiService>('PatronApiService', [
      'setInvoicePostalAddress',
      'removeInvoicePostalAddress',
    ]);
    state = jasmine.createSpyObj<PatronStateService>('PatronStateService', [
      'currentMutationContext',
      'replacePatron',
    ]);
    state.currentMutationContext.and.returnValue(context);
    alert = jasmine.createSpyObj<AlertService>('AlertService', [
      'success',
      'warn',
      'error',
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

    translate.setTranslation('en', invoiceTranslations());
    translate.use('en');
  });

  it('starts in preferred mode and structurally hides custom fields', () => {
    create(patron);

    expect(fixture.componentInstance.form.controls.source.value).toBe(
      'preferred',
    );
    expect(
      fixture.nativeElement.querySelector('[data-custom-fields]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Home Street 1');
    expect(
      fixture.nativeElement.querySelector(
        '[data-source-option="preferred"] .invoice-editor__preferred-value',
      ).textContent,
    ).toContain('Home Street 1');
    expect(
      fixture.nativeElement.querySelector(
        '.invoice-editor__heading .slsp-status',
      ),
    ).toBeNull();
  });

  it('creates a trimmed custom address with a null freshness reference', () => {
    create(patron);
    api.setInvoicePostalAddress.and.returnValue(of(customPatron));
    fixture.componentInstance.form.controls.source.setValue('custom');
    fixture.componentInstance.form.patchValue({
      line1: ' Billing AG ',
      line2: ' ',
      postalCode: ' 3000 ',
      city: ' Bern ',
      countryCode: 'che',
    });

    fixture.componentInstance.save();

    expect(api.setInvoicePostalAddress).toHaveBeenCalledOnceWith('patron-1', {
      elementReference: null,
      line1: 'Billing AG',
      line2: null,
      line3: null,
      line4: null,
      postalCode: '3000',
      city: 'Bern',
      countryCode: 'CHE',
    });
    expect(state.replacePatron).toHaveBeenCalledOnceWith(customPatron, context);
  });

  it('replaces and removes only with the confirmed element reference', () => {
    create(customPatron);

    const replaced = {
      ...customPatron,
      invoicePostalAddress: {
        elementReference: 'postal-reference',
        line1: 'Billing AG',
        line2: null,
        line3: null,
        line4: null,
        postalCode: '3000',
        countryCode: 'CHE',
        city: 'Basel',
      },
    };

    api.setInvoicePostalAddress.and.returnValue(of(replaced));
    fixture.componentInstance.form.controls.city.setValue('Basel');
    fixture.componentInstance.save();

    expect(api.setInvoicePostalAddress).toHaveBeenCalledOnceWith(
      'patron-1',
      jasmine.objectContaining({ elementReference: 'postal-reference' }),
    );

    api.removeInvoicePostalAddress.and.returnValue(of(patron));
    fixture.componentInstance.form.controls.source.setValue('preferred');
    fixture.componentInstance.save();

    expect(api.removeInvoicePostalAddress).toHaveBeenCalledOnceWith(
      'patron-1',
      'postal-reference',
    );
  });

  it('defaults to custom and disables preferred when no preferred address exists', () => {
    create({ ...patron, postalAddresses: [] });

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
    ).toContain('No preferred postal address');
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

  it('displays and rejects a normalized unknown legacy country code', () => {
    create({
      ...customPatron,
      invoicePostalAddress: {
        ...customPatron.invoicePostalAddress,
        countryCode: ' zzz ',
      } as CardPatron['invoicePostalAddress'],
    });

    expect(fixture.componentInstance.form.controls.countryCode.value).toBe(
      'ZZZ',
    );
    expect(fixture.componentInstance.countryOptions[0]).toEqual({
      code: 'ZZZ',
      label: 'ZZZ',
    });
    expect(
      fixture.componentInstance.form.controls.countryCode.hasError(
        'invoiceCountry',
      ),
    ).toBeTrue();
  });

  it('shows a length error for every over-limit postal field', () => {
    create(customPatron);
    fixture.componentInstance.form.patchValue({
      line2: 'x'.repeat(41),
      line3: 'x'.repeat(41),
      line4: 'x'.repeat(41),
      postalCode: '12345678',
      city: 'x'.repeat(33),
    });

    fixture.componentInstance.save();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-error="too-long"]').length,
    ).toBe(5);
    expect(api.setInvoicePostalAddress).not.toHaveBeenCalled();
  });

  it('disables the complete form while a request is active', () => {
    create(customPatron);

    const response = new Subject<CardPatron>();

    api.setInvoicePostalAddress.and.returnValue(response);
    fixture.componentInstance.form.controls.city.setValue('Basel');
    fixture.componentInstance.save();

    expect(fixture.componentInstance.form.disabled).toBeTrue();

    response.next(customPatron);
    response.complete();
    expect(fixture.componentInstance.form.enabled).toBeTrue();
    expect(fixture.componentInstance.form.controls.city.enabled).toBeTrue();
  });

  it('makes no request for invalid or unchanged custom data', () => {
    create(customPatron);
    fixture.componentInstance.save();
    fixture.componentInstance.form.controls.line1.setValue('');
    fixture.componentInstance.save();

    expect(api.setInvoicePostalAddress).not.toHaveBeenCalled();
    expect(api.removeInvoicePostalAddress).not.toHaveBeenCalled();
  });

  it('retains dirty input on a safe API warning and restores it on cancel', () => {
    create(customPatron);
    api.setInvoicePostalAddress.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              type: 'INVALID_INVOICE_POSTAL_ADDRESS',
              errorId: 'support-postal',
              context: {},
            },
          }),
      ),
    );
    fixture.componentInstance.form.controls.city.setValue('Changed');
    fixture.componentInstance.save();

    expect(fixture.componentInstance.form.controls.city.value).toBe('Changed');
    expect(alert.warn).toHaveBeenCalled();

    fixture.componentInstance.cancel();
    expect(fixture.componentInstance.form.controls.city.value).toBe('Bern');
  });

  it('does not erase dirty postal input after an e-mail-only patron refresh', () => {
    create(customPatron);
    fixture.componentInstance.form.controls.city.setValue('Dirty city');
    fixture.componentRef.setInput('patron', {
      ...customPatron,
      invoiceEmailAddress: {
        elementReference: 'email-reference',
        emailAddress: 'invoice@example.org',
      },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.city.value).toBe(
      'Dirty city',
    );
  });

  it('does not erase dirty custom input after a preferred-address refresh', () => {
    create(customPatron);
    fixture.componentInstance.form.controls.city.setValue('Dirty city');
    fixture.componentInstance.form.markAsDirty();
    fixture.componentRef.setInput('patron', {
      ...customPatron,
      postalAddresses: [
        {
          ...customPatron.postalAddresses[0],
          line1: 'New preferred street 2',
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.city.value).toBe(
      'Dirty city',
    );
    expect(fixture.componentInstance.preferredPostalAddress?.line1).toBe(
      'New preferred street 2',
    );
  });

  it('resets dirty input when the selected patron changes with identical contacts', () => {
    create(customPatron);
    fixture.componentInstance.form.controls.city.setValue('Dirty city');
    fixture.componentInstance.form.markAsDirty();
    state.currentMutationContext.and.returnValue({
      patronId: 'patron-2',
    } as PatronMutationContext);
    fixture.componentRef.setInput('patron', { ...customPatron });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.city.value).toBe('Bern');
    expect(fixture.componentInstance.form.pristine).toBeTrue();
  });

  it('keeps removal unavailable when a custom address has no preferred fallback', () => {
    create({ ...customPatron, postalAddresses: [] });

    const preferredRadio = fixture.nativeElement.querySelector(
      '[data-source="preferred"] input',
    ) as HTMLInputElement;

    expect(preferredRadio.disabled).toBeTrue();
    fixture.componentInstance.form.controls.source.setValue('preferred');
    fixture.componentInstance.save();
    expect(api.removeInvoicePostalAddress).not.toHaveBeenCalled();
  });

  function create(value: CardPatron): void {
    fixture = TestBed.createComponent(InvoicePostalAddressComponent);
    fixture.componentRef.setInput('patron', value);
    fixture.detectChanges();
  }
});

function invoiceTranslations(): object {
  return {
    General: { Cancel: 'Cancel' },
    Settings: {
      PostalAddress: 'Postal address',
      UsePreferredPostalAddress: 'Use preferred postal address',
      UseCustomPostalAddress: 'Use a different postal address',
      PreferredPostalAddressMissing: 'No preferred postal address',
      Line1: 'Address line 1',
      Line2: 'Address line 2',
      Line3: 'Address line 3',
      Line4: 'Address line 4',
      PostalCode: 'Postal code',
      City: 'City',
      Country: 'Country',
      Required: 'Required',
      TooLong: 'Too long',
      InvalidCountry: 'Choose a country',
      SavePostalAddress: 'Save postal address',
      InvoicePostalSetSuccess: 'Postal address saved',
      InvoicePostalRemoveSuccess: 'Postal address removed',
    },
    Errors: {
      InvalidInvoicePostalAddress: 'Invalid postal address',
      UnexpectedFailure: 'Unexpected failure',
      SelectedPatron: 'Selected patron',
      SupportId: 'Support ID: {{errorId}}',
    },
  };
}
