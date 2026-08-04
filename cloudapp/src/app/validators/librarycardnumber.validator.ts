// @ts-nocheck -- Removed in Task 6 with the legacy validator.
import { FormControl } from '@angular/forms';
import { Librarycardnumber } from '../model/librarycardnumber.model';

export function libraryCardValidator(control: FormControl) {
  const isValid = Librarycardnumber.isValidLibraryCardNumber(control.value);

  return isValid ? null : { wrongColor: 'red' };
}
