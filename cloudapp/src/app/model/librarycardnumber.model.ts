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
        /^200\d{7}$/i,
        // RERO Valais
        /^201\d{7}$/i,
        // RERO Neuchâtel
        /^20[345]\d{7}$/i,
        // RERO Genève
        /^(20[67]\d{7}|307\d{7}|407\d{7}|507\d{7})$/i,
        // Bundesinstitutionen
        /^208\d{7}$/i,
        // Service Bibliothèques & Archives de la Ville de Lausanne
        /^BVL\d{7}$/i,
        // RERO Vaud
        /^209\d{7}$/i,
        // Olympic World Library (Le Centre d’Etudes Olympiques)
        /^220\d{7}$/i,
        // RERO IUED
        /^(L[1-9]\d{2}|L\d{4})$/i,
        // Alexandria
        /^295\d{7}$/i,
        // Schweizerische Nationalbibliothek
        /^(nb\d+|210\d{7})$/i,
        /^290\d{6,7}$/i,
        // IDS Basel
        /^[AB][A-Z\d]*\d{2,}[A-Z\d]*$/i, /^(A[A-Z\d]*\d{2,}[A-Z\d]*|MBS[A-Z\d]*\d{2,}[A-Z\d]*|\d{7}|\d{11})$/i,
        // IDS Bern
        /^B[A-Z\d]*\d{2,}[A-Z\d]*$/i, /^(B[A-Z\d]*\d{2,}[A-Z\d]*|\d{9})$/i,
        // IDS Luzern
        /^L\-[A-Z\d]*\d{2,}[A-Z\d]*$/i, /^(L[A-Z\d]*\d{2,}[A-Z\d]*|FHZ\d{7})$/i,
        // IDS St. Gallen
        /^H\-[A-Z\d]*\d{2,}[A-Z\d]*$/i, /^(H[A-Z\d]*\d{2,}[A-Z\d]*|\d{13})$/i,
        // IDS Zürich Universität
        /^U\-[A-Z\d]*\d{2,}[A-Z\d]*$/i, /^([UM][A-Z\d]*\d{2,}[A-Z\d]*)$/i,
        // NEBIS
        // This regix unfortunately matches a lot of numbers
        /^E\-[A-Z\d]*\d{2,}[A-Z\d]*$/i, /^([ESP][A-Z\d]*\d{2,}[A-Z\d]*)$/i,
        // IDS Zürich Zentralbibliothek
        /^(Z\-[A-Z\d]*\d{2,}[A-Z\d]*|E\-[A-Z\d]*\d{2,}[A-Z\d]*)$/i, /^[ZY][A-Z\d]*\d{2,}[A-Z\d]*$/i,
        // Aargauer Bibliotheksnetz
        /^(ABN\d+|BBM\d+)$/i,
        // Bibliotheksverbund Graubünden
        /^Q[A-Z\d]*\d{2,}[A-Z\d]*$/i, /^(Q\d+|\d{9})$/i,
        // St. Galler Bibliotheksnetz (SGBN)
        /^G\-[A-Z\d]*\d{2,}[A-Z\d]*$/i, /^(G\d+|GKBG\d+|GKSB\d+|GKSH\d+|GKWA\d+|GKWI\d+|GBAR\d+|GBEB\d+|GKSS\d+)$/i,
        // Sistema Bibliotecario Ticinese (SBT)
        /^T\-[A-Z\d]*\d{2,}[A-Z\d]*$/i, /^(T[A-Z\d]*\d{2,}[A-Z\d]*|202\d{7})$/i,
        // HSG staff library card numbers. See https://task.slsp.ch/browse/SUPPORT-4486
        /^62991200\d{8}$/i,
        // FHNW library card numbers. See https://task.slsp.ch/browse/SUPPORT-7471
        /^N\d{8,9}$/i,
        // OST library card numbers. See https://task.slsp.ch/browse/SUPPORT-7935
        /^OST\d+$/i,
        // Pädagogische Hochschule Zürich, Bibliothek
        /^PHZH\d{6}$/i,
        // USI library. See https://slsp.atlassian.net/browse/SUPPORT-15500
        /^19179\d{5}$/i,
        // HESSO Library. See https://slsp.atlassian.net/browse/SUPPORT-18045
        /^HES\d{7}$/i,
        // Berner Bildungszentrum Pflege. See https://slsp.atlassian.net/browse/SUPPORT-19620
        /^BZP\d{7}$/i,
        // Israelitisch Cultusgemeinde Zürich. See https://slsp.atlassian.net/browse/SUPPORT-16764
        /^ICZ\d{7}$/i,
        // Landesbibliothek Liechtenstein LiLB / Bibliothek Universität Liechtenstein
        /^FM\d{6}$/i, /^FS\d{6}$/i, /^C\d{6}$/i, /^ILL\d{4}$/i, /^GBA[LS]?\d+$/i, /^GRU\d{5,6}$/i, /^GSB\d{5,6}$/i, /^SZM\d{5,6}$/i, /^SZU[A-Z\d]?\d{5}$/i, /^IAP\d{5}$/i,
        // SLSP
        /^SLSP\-\d{9}$/i, // Altes Format
        /^SLSP\d{9}$/i // Neues Format
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
        return this.allowedRegex.some(regex => librarycardnumber.match(regex));
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
