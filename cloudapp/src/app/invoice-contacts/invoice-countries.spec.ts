import {
  buildInvoiceCountryOptions,
  isSupportedInvoiceCountry,
} from './invoice-countries';

describe('invoice countries', () => {
  it('contains the complete Java 21 ISO alpha-3 country set', () => {
    const options = buildInvoiceCountryOptions('en');

    expect(options).toHaveSize(249);
    expect(isSupportedInvoiceCountry('CHE')).toBeTrue();
    expect(isSupportedInvoiceCountry('che')).toBeFalse();
  });

  it('prioritizes the six registration-platform countries without duplicates', () => {
    const options = buildInvoiceCountryOptions('en');

    expect(options.slice(0, 6).map(({ code }) => code)).toEqual([
      'CHE',
      'DEU',
      'AUT',
      'LIE',
      'ITA',
      'FRA',
    ]);
    expect(new Set(options.map(({ code }) => code)).size).toBe(options.length);
  });

  it('locale-sorts remaining countries by their localized labels', () => {
    const options = buildInvoiceCountryOptions('de');
    const remainingLabels = options.slice(6).map(({ label }) => label);
    const expected = [...remainingLabels].sort(new Intl.Collator('de').compare);

    expect(remainingLabels).toEqual(expected);
  });

  it('shows an unknown legacy code first but does not treat it as supported', () => {
    const options = buildInvoiceCountryOptions('en', 'zzz');

    expect(options[0]).toEqual({ code: 'ZZZ', label: 'ZZZ' });
    expect(isSupportedInvoiceCountry('ZZZ')).toBeFalse();
  });

  it('falls back to the alpha-3 code when no localized label exists', () => {
    const options = buildInvoiceCountryOptions('en', null, () => undefined);

    expect(options[0].label).toBe('CHE');
  });
});
