import { FormControl } from '@angular/forms';
import { InlineMutationError } from './inline-mutation-error';

describe('InlineMutationError', () => {
  it('marks an otherwise valid field only while its backend error is present', () => {
    const error = new InlineMutationError(['INVALID_LIBRARY_CARD_NUMBER']);
    const control = new FormControl('123');

    expect(error.isErrorState(control, null)).toBeFalse();
    expect(error.accept('INVALID_LIBRARY_CARD_NUMBER', 'Invalid')).toBeTrue();
    expect(error.isErrorState(control, null)).toBeTrue();
    error.clear();
    expect(error.isErrorState(control, null)).toBeFalse();
    expect(error.accept('ALMA_UNAVAILABLE', 'Unavailable')).toBeFalse();
    expect(error.message).toBe('');
  });

  it('preserves ordinary touched field validation', () => {
    const error = new InlineMutationError([]);
    const control = new FormControl('');

    control.setErrors({ required: true });
    expect(error.isErrorState(control, null)).toBeFalse();
    control.markAsTouched();
    expect(error.isErrorState(control, null)).toBeTrue();
  });
});
