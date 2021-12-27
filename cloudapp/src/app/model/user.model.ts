export class User {
    userValue:Object;

    constructor(userValue: Object) {
        this.userValue = userValue;
    }

    getUserBlock(blockDescriptionValue: String = ""): Map<String, any> {   
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

    getIsExternal() {
        return this.userValue["primary_id"].match(/^\d+\@.*eduid\.ch$/);

    }
}
