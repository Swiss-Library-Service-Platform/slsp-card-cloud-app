import { Librarycardnumber } from "./librarycardnumber.model";

/**
 * Alma User Object
 *
 * @export
 * @class User
 */
export class User {

    userValue: Object;

    constructor(userValue: Object = {}) {
        this.userValue = userValue;
    }

    /**
     * Get all User Blocks 
     *
     * @param {String} [blockDescriptionValue=""]
     * @return {*}  {Map<String, any>}
     * @memberof User
     */
    getUserBlocks(blockDescriptionValue: String = ""): Map<String, any> {
        var blocks = new Map<String, any>();

        if (!this.userValue["user_block"] || this.userValue["user_blok"]) return blocks;

        for (let userblock of this.userValue["user_block"]) {
            // Block is not active
            if (userblock["block_status"].toUpperCase() !== "ACTIVE") continue;
            // Block expired
            if (userblock["expiry_date"]) {
                let expireDate = new Date(userblock["expiry_date"])
                if (new Date() > expireDate) continue;
            }
            // Block is not on user
            if (userblock["block_type"]["value"].toUpperCase() !== "USER") continue;
            // Not requested block description
            if (blockDescriptionValue && userblock["block_description"]["value"] !== blockDescriptionValue) continue;
            // Add Block
            blocks[userblock["block_description"]["value"]] = userblock;
        }
        return blocks;
    }

    /**
     * Adds a new block to the user
     *
     * @param {String} [blockType="SUSPENDED"]
     * @param {String} [comment=""]
     * @param {String} libCode
     * @param {String} url
     * @memberof User
     */
    addBlock(blockType: String = "SUSPENDED", comment: String = "", libCode: String, url: String): void {
        //create User Object
        let blockObject = {};
        blockObject["segment_type"] = "External";
        blockObject["block_status"] = "Active";
        blockObject["block_note"] = 'Blocked by ' + libCode + ': ' + comment;
        blockObject["created_by"] = 'Alma Cloud App @ ' + url;
        blockObject["block_description"] = {};
        blockObject["block_description"]["value"] = blockType;
        blockObject["block_type"] = {};
        blockObject["block_type"]["value"] = "USER";
        this.userValue["user_block"].push(blockObject);
    }

    /**
     * Removes an existing block from a user
     *
     * @param {String} blockType
     * @return {*}  {Boolean}
     * @memberof User
     */
    removeBlock(blockType: String): Boolean {
        let initialCount = this.userValue["user_block"].length;
        this.userValue["user_block"] = this.userValue["user_block"].filter(function (userblock) {
            return userblock["block_description"]["value"] !== blockType;
        });
        return initialCount != this.userValue["user_block"].length;
    }

    /**
     * Checks whether the user is external or not
     *
     * @return {*}  {boolean}
     * @memberof User
     */
    getIsExternal(): boolean {
        return this.userValue["primary_id"].match(/^\d+\@.*eduid\.ch$/);
    }

    /**
     * Gets the full name of the user
     *
     * @return {*}  {string}
     * @memberof User
     */
    getFullName(): string {
        return this.userValue["full_name"];
    }

    /**
     * Gets all addresses from the user
     * Uses JSON.parse(JSON.stringify) workaround in order to not return an object reference, that will lead to change the user upon a change of the object
     *
     * @return {*}  {Array<Object>}
     * @memberof User
     */
    getAddresses(): Array<Object> {
        // copy without object reference (prevent automatic update)
        let addresses = JSON.parse(JSON.stringify(this.userValue["contact_info"]["address"]));
        return addresses;
    }

    /**
     * Get all library card numbers from the user with id_type 01, 02 or 03
     *
     * @return {*}  {Array<string>}
     * @memberof User
     */
    getLibraryCardNumbers(): Array<string> {
        let libraryCardNumbers = [];
        if (!Array.isArray(this.userValue["user_identifier"]) || this.userValue["user_identifier"].length < 1) {
            return [];
        }
        this.userValue["user_identifier"].forEach((identifier) => {
            if (identifier["id_type"] && identifier["id_type"]["value"] && (
                identifier["id_type"]["value"] == '01' || //ALMA_CODE_LIBRARY_CARD_NUMBER
                identifier["id_type"]["value"] == '02' || //ALMA_CODE_LIBRARY_CARD_NUMBER_NZ
                identifier["id_type"]["value"] == '03' //ALMA_CODE_LIBRARY_CARD_NUMBER_IZ
            )) {
                libraryCardNumbers.push(identifier);
            }
        });
        return libraryCardNumbers;
    }

    /**
     * Gets the matriculation number of a user and returns it together with the dashed (22-222-222) version 
     *
     * @return {*}  {string}
     * @memberof User
     */
    getMatriculationNumber(): string {
        if (!Array.isArray(this.userValue["user_identifier"]) || this.userValue["user_identifier"].length < 1) {
            return null;
        }
        let matriculationNumber;
        this.userValue["user_identifier"].forEach((identifier) => {
            if (identifier["id_type"] && identifier["id_type"]["value"] && (
                identifier["id_type"]["value"] == '04' //ALMA_CODE_MATRICULATION_NUMBER
            )) {
                matriculationNumber = identifier['value'] + ' / ' + Librarycardnumber.getDashedMatriculationNumber(identifier['value']);
            }
        });
        return matriculationNumber;
    }

    /**
     * Adds a library card number to the user
     *
     * @param {string} libraryCardNumber
     * @param {string} primaryId
     * @param {string} instCode
     * @return {*}  {boolean}
     * @memberof User
     */
    addLibraryCardNumber(libraryCardNumber: string, primaryId: string, instCode: string): boolean {
        libraryCardNumber = Librarycardnumber.sanitizeLibraryCardNumber(libraryCardNumber);
        // check if number exists already
        if (this.getLibraryCardNumbers().indexOf(libraryCardNumber) != -1) return false;
        //create user_identifier Object
        let identifierObject = {};
        let currentDate = new Date();
        identifierObject["value"] = libraryCardNumber;
        identifierObject["id_type"] = {};
        identifierObject["id_type"]["value"] = '02'; // ALMA_CODE_LIBRARY_CARD_NUMBER_NZ
        identifierObject["status"] = "ACTIVE";
        identifierObject["segment_type"] = "External";
        identifierObject["note"] = "Added by " + primaryId + " from " + instCode + " on " + currentDate.toISOString().split('T')[0];
        this.userValue["user_identifier"].push(identifierObject);

        if (Librarycardnumber.isValidImmatriculationNumber(libraryCardNumber)) {
            // create matriculation number Object
            let immatriculationObject = {};
            let dashedMatriculationNumber = Librarycardnumber.getDashedMatriculationNumber(libraryCardNumber);
            let currentDate = new Date();
            immatriculationObject["value"] = dashedMatriculationNumber;
            immatriculationObject["id_type"] = {};
            immatriculationObject["id_type"]["value"] = '02'; // ALMA_CODE_LIBRARY_CARD_NUMBER_NZ
            immatriculationObject["status"] = "ACTIVE";
            immatriculationObject["segment_type"] = "External";
            immatriculationObject["note"] = "Added by " + primaryId + " from " + instCode + " on " + currentDate.toISOString().split('T')[0];
            this.userValue["user_identifier"].push(immatriculationObject);
        };
        return true;
    }

    /**
     * Removes a library card number from the user
     *
     * @param {string} libraryCardNumber
     * @return {*}  {Boolean}
     * @memberof User
     */
    removeLibraryCardNumber(libraryCardNumber: string): Boolean {
        let initialCount = this.userValue["user_identifier"].length;
        let isImmatriculationNumber = Librarycardnumber.isValidImmatriculationNumber(libraryCardNumber["value"]);
        this.userValue["user_identifier"] = this.userValue["user_identifier"].filter(function (identifier) {
            return !isImmatriculationNumber ? identifier["value"] !== libraryCardNumber['value']
                // also remove matriculation number;
                : (identifier["value"] !== libraryCardNumber['value'] && Librarycardnumber.getDashedMatriculationNumber(libraryCardNumber["value"]) !== identifier['value']);
        });
        return initialCount != this.userValue["user_identifier"].length;
    }

    /**
     * Sets the preferred address
     *
     * @param {object} address
     * @param {string} url
     * @return {*}  {Boolean}
     * @memberof User
     */
    setPreferredAddress(address: object, url: string): Boolean {
        let isChanged = false;
        this.userValue["contact_info"]["address"].map((currAddress) => {
            if (JSON.stringify(currAddress) == JSON.stringify(address)) {
                currAddress.preferred = true;
                isChanged = true;
            } else {
                currAddress.preferred = false;
            }
            return currAddress;
        });
        if (!isChanged) return false;
        this.addSetting('preferredPostalAddressType', address['address_type'][0]['value'], url);
        return true;
    }

    /**
     * Get the settings: an entity in the user_note that Starts with 'User Settings: [...]')
     *
     * @return {*}  {[Object, Object]}
     * @memberof User
     */
    getSettings(): [Object, Object] {
        let settingsObject = null;
        let settingsValue = '{}';
        if (!Array.isArray(this.userValue["user_note"]) || this.userValue["user_note"].length < 1) {
            return [settingsObject, JSON.parse(settingsValue)];
        }
        this.userValue["user_note"].forEach((setting) => {
            if (!setting["note_type"] || setting['note_type']['value'] == 'Other') {
                return;
            }
            let regexMatches = setting['note_text'].match(/User Settings: (.+)/);
            if (!regexMatches) return;
            settingsValue = regexMatches[1];
            settingsObject = setting;
        });
        return [settingsObject, JSON.parse(settingsValue)];
    }

    /**
     * Adds a setting 
     * Create the setting object in the user_notes if its not existing already
     *
     * @param {string} key
     * @param {string} value
     * @param {string} url
     * @memberof User
     */
    addSetting(key: string, value: string, url: string) {
        let settings = this.getSettings();
        let isUserSettingsExisting = settings[0] != null;
        settings[1][key] = value;
        let noteText = 'User Settings: ' + JSON.stringify(settings[1]);

        if (isUserSettingsExisting) {
            settings[0]['note_text'] = noteText;
        } else {
            let noteObject = {};
            noteObject['segment_type'] = 'External';
            noteObject['note_type'] = {};
            noteObject['note_type']['value'] = 'Other';
            noteObject['note_text'] = noteText;
            noteObject['user_viewable'] = false;
            noteObject['popup_note'] = false;
            noteObject['created_by'] = 'Alma Cloud App @ ' + url;
            noteObject['created_date'] = new Date().toISOString();
            this.userValue['user_note'].push(noteObject);
        }
    }
}
