export class Librarycardnumber {

    static sanitizeLibraryCardNumber(libraryCardNumber) {
        if (libraryCardNumber.match(/slsp-/i)) {
            libraryCardNumber.replace(/-/, '');
        }
        return libraryCardNumber.toLowerCase();
    }

    /*
    static isValidLibraryCardNumber(librarycardnumber: string) {
        // Matriculation number
        if (librarycardnumber.match(/(\d{2})(\d{3})(\d{3})/)) {
            return Librarycardnumber.isValidImmatriculationNumber(librarycardnumber);
        }

        // Reject if number contains umlauts or other non-standard characters
        if (librarycardnumber.match(/[^a-zA-Z0-9\-]/)) {
            return false;
        }

        // Reject specific number ranges:
        // Mathias Stocker reqested on 2020-11-19 to reject these numbers 
        if (preg_match('/^1100\d{5}$/i', $librarycardnumber)) {
            return false;
        }

        return librarycardnumber.length == 3;
    }
    */

    static isValidImmatriculationNumber(immatriculationNumber: string) {
        // Must be 8 chars long
        if (immatriculationNumber.length != 8) {
            return false;
        }
        // Must contain only digits
        if (immatriculationNumber.match(/[^0-9]/)) {
            return false;
        }
        return true;
    }

}
