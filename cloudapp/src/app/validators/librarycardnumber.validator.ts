import { FormControl } from '@angular/forms';
import { Librarycardnumber } from '../model/librarycardnumber.model';

export function libraryCardValidator(control: FormControl) {
    let isValid = Librarycardnumber.isValidLibraryCardNumber(control.value);
    return isValid ? null : { wrongColor: 'red' };
}
