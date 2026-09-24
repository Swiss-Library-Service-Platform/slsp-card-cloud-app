import { FormControl } from '@angular/forms';
import { Librarycardnumber } from '../model/librarycardnumber.model';

export function libraryCardValidator(control: FormControl) {
    if (Librarycardnumber.isBlockedLibraryCardNumber(control.value)) {
        return { blockedBarcode: true };
    }
    let isValid = Librarycardnumber.isValidLibraryCardNumber(control.value);
    return isValid ? null : { wrongColor: 'red' };
}
