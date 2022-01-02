export class User {
    userValue:Object;

    constructor(userValue: Object) {
        this.userValue = userValue;
    }

    getUserBlocks(blockDescriptionValue: String = ""): Map<String, any> {   
        var blocks = new Map<String, any>();
        console.log(this.userValue);
        
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
            //Add Block
            blocks[userblock["block_description"]["value"]] = userblock;
        }
        return blocks;
      }

    addUserblock (blockType: String = "SUSPENDED", comment: String = ""): void {
        //create User Object
        let blockObject = {};
        blockObject["segment_type"] = "External";
        blockObject["block_status"] = "Active";
        blockObject["block_note"] = comment; //TODO: append IZ
        blockObject["created_by"] = "" //TODO:
        blockObject["block_description"] = {};
        blockObject["block_description"]["value"] = blockType;
        blockObject["block_type"] = {};
        blockObject["block_type"]["value"] = "USER";
        console.log(this.userValue["user_block"]);
        this.userValue["user_block"].push(blockObject);
    }

    getIsExternal(): boolean {
        return this.userValue["primary_id"].match(/^\d+\@.*eduid\.ch$/);
    }

    getFullName(): string {
        return this.userValue["full_name"];
    }

    getAddresses(): Array<Object> {
        return this.userValue["contact_info"]["address"];
    }

    getLibraryCardNumbers(): Array<string> {
        let libraryCardNumbers = [];
        if (!Array.isArray(this.userValue["user_identifier"]) || this.userValue["user_identifier"].length < 1) {
            return [];
        }
        this.userValue["user_identifier"].forEach((identifier) => {
            console.log(identifier);
            if (identifier["id_type"] && identifier["id_type"]["value"] && (
                identifier["id_type"]["value"] == '01'|| //ALMA_CODE_LIBRARY_CARD_NUMBER
                identifier["id_type"]["value"] == '02' || //ALMA_CODE_LIBRARY_CARD_NUMBER_NZ
                identifier["id_type"]["value"] == '03' //ALMA_CODE_LIBRARY_CARD_NUMBER_IZ
            )) {
                libraryCardNumbers.push(identifier["value"]);
            }
        })
        return libraryCardNumbers
    }
}
