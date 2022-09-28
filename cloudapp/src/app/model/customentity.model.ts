import { Entity, EntityType } from "@exlibris/exl-cloudapp-angular-lib";
import { Observable } from 'rxjs';

export class CustomEntity implements Entity {

    id: string;
    type: EntityType;
    link: string;
    public description: string;
    primary_id: string;

    constructor(entity: Entity, primary_id: string) {
        this.id = entity.id;
        this.type = entity.type;
        this.link = entity.link;
        this.description = entity.description;
        this.primary_id = primary_id;
    }

}
