import { FormControl } from '@angular/forms';

import {
  invoiceCountryValidator,
  invoiceEmailValidator,
  invoiceMaxLengthValidator,
  invoiceRequiredValidator,
  normalizeInvoiceEmail,
  normalizeInvoicePostalAddress,
} from './invoice-contact-rules';

describe('invoice contact rules', () => {
  it('validates required and maximum lengths after trimming', () => {
    const required = new FormControl('   ', {
      nonNullable: true,
      validators: invoiceRequiredValidator,
    });
    const maximum = new FormControl(` ${'x'.repeat(40)} `, {
      nonNullable: true,
      validators: invoiceMaxLengthValidator(40),
    });

    expect(required.hasError('required')).toBeTrue();
    expect(maximum.valid).toBeTrue();
    maximum.setValue('x'.repeat(41));
    expect(maximum.hasError('maxlength')).toBeTrue();
  });

  it('trims postal fields, uppercases country, and nulls blank optional lines', () => {
    expect(
      normalizeInvoicePostalAddress({
        elementReference: null,
        line1: '  Example AG ',
        line2: ' ',
        line3: ' Accounts ',
        line4: '',
        postalCode: ' 8000 ',
        city: ' Zürich ',
        countryCode: ' che ',
      }),
    ).toEqual({
      elementReference: null,
      line1: 'Example AG',
      line2: null,
      line3: 'Accounts',
      line4: null,
      postalCode: '8000',
      city: 'Zürich',
      countryCode: 'CHE',
    });
  });

  it('accepts supported alpha-3 countries and rejects unknown or alpha-2 values', () => {
    const control = new FormControl('CHE', {
      nonNullable: true,
      validators: invoiceCountryValidator,
    });

    expect(control.valid).toBeTrue();
    control.setValue('CH');
    expect(control.hasError('invoiceCountry')).toBeTrue();
    control.setValue('ZZZ');
    expect(control.hasError('invoiceCountry')).toBeTrue();
  });

  ['a@example.org', "billing.o'hara+tag@example-domain.org", 'x@y.co'].forEach(
    (value) => {
      it(`accepts the backend-compatible e-mail ${value}`, () => {
        const control = new FormControl(value, {
          nonNullable: true,
          validators: invoiceEmailValidator,
        });

        expect(control.valid).toBeTrue();
      });
    },
  );

  [
    '',
    '.a@example.org',
    'a.@example.org',
    'a..b@example.org',
    'a@example',
    'a@-example.org',
    'a@example-.org',
    'a@example..org',
    'a@@example.org',
    'ä@example.org',
    `${'a'.repeat(53)}@example.org`,
  ].forEach((value) => {
    it(`rejects the backend-incompatible e-mail ${value}`, () => {
      const control = new FormControl(value, {
        nonNullable: true,
        validators: invoiceEmailValidator,
      });

      expect(control.hasError('invoiceEmail')).toBeTrue();
    });
  });

  it('trims a valid e-mail before submission', () => {
    expect(normalizeInvoiceEmail(' invoice@example.org ')).toBe(
      'invoice@example.org',
    );
  });
});
