/**
 * Library card number model
 * Serves functions to validate and format the library card numbers
 *
 * @export
 * @class Librarycardnumber
 */
export class Librarycardnumber {

    static allowedRegex = [
        // RERO Freiburg
        /^(200)\d{7}$/,
        // RERO Valais
        /201\d{7}/,
        // RERO Neuchâtel
        /20[345]\d{7}/,
        // RERO Genève
        /(20[67]\d{7}|307\d{7}|407\d{7}|507\d{7})/,
        // Bundesinstitutionen
        /208\d{7}/,
        // Service Bibliothèques & Archives de la Ville de Lausanne
        /BVL\d{7}/,
        // RERO Vaud
        /209\d{7}/,
        // Olympic World Library (Le Centre d’Etudes Olympiques)
        /220\d{7}/,
        // RERO IUED
        /(L[1-9]\d{2}|L\d{4})/,
        // Alexandria
        /295\d{7}/,
        // Schweizerische Nationalbibliothek
        /(nb\d+|210\d{7})/,
        // IDS Basel
        /[AB][A-Z\d]*\d{2,}[A-Z\d]*/, /(A[A-Z\d]*\d{2,}[A-Z\d]*|MBS[A-Z\d]*\d{2,}[A-Z\d]*|\d{7}|\d{11})/,
        // IDS Bern
        /B[A-Z\d]*\d{2,}[A-Z\d]*/, /(B[A-Z\d]*\d{2,}[A-Z\d]*|\d{9})/,
        // IDS Luzern
        /L\-[A-Z\d]*\d{2,}[A-Z\d]*/, /(L[A-Z\d]*\d{2,}[A-Z\d]*|FHZ\d{7})/,
        // IDS St. Gallen
        /H\-[A-Z\d]*\d{2,}[A-Z\d]*/, /(H[A-Z\d]*\d{2,}[A-Z\d]*|\d{13})/,
        // IDS Zürich Universität
        /U\-[A-Z\d]*\d{2,}[A-Z\d]*/, /([UM][A-Z\d]*\d{2,}[A-Z\d]*)/,
        // NEBIS
        /E\-[A-Z\d]*\d{2,}[A-Z\d]*/, /([ESP][A-Z\d]*\d{2,}[A-Z\d]*)/,
        // IDS Zürich Zentralbibliothek
        /(Z\-[A-Z\d]*\d{2,}[A-Z\d]*|E\-[A-Z\d]*\d{2,}[A-Z\d]*)/, /[ZY][A-Z\d]*\d{2,}[A-Z\d]*/,
        // Aargauer Bibliotheksnetz
        /(ABN\d+|BBM\d+)/,
        // Bibliotheksverbund Graubünden
        /Q[A-Z\d]*\d{2,}[A-Z\d]*/, /(Q\d+|\d{9})/,
        // St. Galler Bibliotheksnetz (SGBN)
        /G\-[A-Z\d]*\d{2,}[A-Z\d]*/, /(G\d+|GKBG\d+|GKSB\d+|GKSH\d+|GKWA\d+|GKWI\d+|GBAR\d+|GBEB\d+)/,
        // Sistema Bibliotecario Ticinese (SBT)
        /T\-[A-Z\d]*\d{2,}[A-Z\d]*/, /(T[A-Z\d]*\d{2,}[A-Z\d]*|202\d{7})/,
        // HSG staff library card numbers. See https://task.slsp.ch/browse/SUPPORT-4486
        /62991200\d{8}/,
        // FHNW library card numbers. See https://task.slsp.ch/browse/SUPPORT-7471
        /N\d{8,9}/,
        // OST library card numbers. See https://task.slsp.ch/browse/SUPPORT-7935
        /OST\d+/,
        // SLSP
        /SLSP\-\d{9}$/, // Altes Format
        /SLSP\d{9}/ // Neues Format
    ];

    /**
     * Sanitizes the number (removes the '-')
     *
     * @static
     * @param {string} libraryCardNumber
     * @return {*}  {string}
     * @memberof Librarycardnumber
     */
    static sanitizeLibraryCardNumber(libraryCardNumber: string): string {
        if (!libraryCardNumber.match(/slsp-/i)) {
            libraryCardNumber = libraryCardNumber.replace(/-/g, '');
        }
        return libraryCardNumber.toLowerCase();
    }

    /**
     * Gets the dashed version (12-123-123) of a matriculation number (12123123)
     *
     * @static
     * @param {string} immatriculationNumber
     * @return {*}  {string}
     * @memberof Librarycardnumber
     */
    static getDashedMatriculationNumber(immatriculationNumber: string): string {
        return immatriculationNumber.replace(/(\d{2})(\d{3})(\d{3})/, "$1-$2-$3");
    }

    /**
     * Checks whether the librarycardnumber is removable from the cloud app
     * Is removable when Type = '02' and does not include 'via edu-ID'
     *
     * @static
     * @param {Object} libraryCardNumber
     * @return {*}  {Boolean}
     * @memberof Librarycardnumber
     */
    static isRemovable(libraryCardNumber: Object): Boolean {
        let matchNote = null;
        if (libraryCardNumber['note']) {
            matchNote = libraryCardNumber['note'].match(/via edu-ID/i);
        }
        return libraryCardNumber["id_type"]["value"] == '02'
            && matchNote == null;
    }

    /**
     * Checks where the number is a dashed matriculation number
     *
     * @static
     * @param {Object} libraryCardNumber
     * @return {*}  {Boolean}
     * @memberof Librarycardnumber
     */
    static isDashedLibraryCardNumber(libraryCardNumber: Object): Boolean {
        let matchImma = libraryCardNumber['value'].match(/(\d{2})-(\d{3})-(\d{3})/);
        return matchImma != null;
    }

    /**
     * Checks if the number is a valid library card number
     *
     * @static
     * @param {string} librarycardnumber
     * @return {*} 
     * @memberof Librarycardnumber
     */
    static isValidLibraryCardNumber(librarycardnumber: string) {
        if (!librarycardnumber) return false;

        // Reject if number contains umlauts or other non-standard characters
        if (librarycardnumber.match(/[^a-zA-Z0-9\-]/)) {
            return false;
        }

        // Reject specific number ranges:
        // Mathias Stocker reqested on 2020-11-19 to reject these numbers 
        if (librarycardnumber.match(/^1100\d{5}$/i)) {
            return false;
        }

        // Check all regex of possible numbers from IZs
        // TODO: check all regex
        let isMatched = false;
        this.allowedRegex.forEach((regex) => {
            var regExp = new RegExp(regex);
            if (librarycardnumber.match(regExp)) {
                isMatched = true;
            }
        });
        return isMatched;
    }


    /**
     * Checks whether the number is a valid immatriculation number
     *
     * @static
     * @param {string} immatriculationNumber
     * @return {*} 
     * @memberof Librarycardnumber
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
