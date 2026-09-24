import { FormControl } from '@angular/forms';
import { libraryCardValidator } from './librarycardnumber.validator';

describe('libraryCardValidator', () => {
  it('returns a distinct error for blocked barcodes', () => {
    expect(libraryCardValidator(new FormControl('e-1207001'))).toEqual({ blockedBarcode: true });
  });

  it('preserves the existing error for invalid formats', () => {
    expect(libraryCardValidator(new FormControl('invalid!'))).toEqual({ wrongColor: 'red' });
  });

  it('accepts barcodes outside the blocked range', () => {
    expect(libraryCardValidator(new FormControl('E1209500'))).toBeNull();
  });
});
