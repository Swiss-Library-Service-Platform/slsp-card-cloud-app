import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable  } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { Component, OnInit, OnDestroy} from '@angular/core';
import { CloudAppRestService, CloudAppEventsService, Request, HttpMethod, 
  Entity, RestErrorResponse, AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { User } from '../model/user.model';


@Injectable({
  providedIn: 'root'
})
export class LibraryManagementService {

  public user:User;
  private userEntity:Entity
  private readonly _primaryid = new BehaviorSubject<String>("");;

  constructor(
    private restService: CloudAppRestService,
  ) { }

  // Expose the observable$ part of the _todos subject (read only stream)
  getPrimaryId(): Observable<String> {
    return this._primaryid.asObservable();
  }

  private _setPrimaryId(primary_id: string): void {
    this._primaryid.next(primary_id);
  }

  async getUserFromEntity (entity: Entity) {
    try {
      const user = await this.restService.call<any>(entity.link).toPromise();
      this.user = new User(user);
      this.userEntity = entity;
      this._setPrimaryId(user.primary_id);
      return true;
    } catch (e: unknown) {
      //TODO: this.alert.error('Failed to retrieve entity: ' + error.message)
      return false;
    }
  }

  addUserblock (blockType: String, comment: String = "") {

    //create User Object
    this.user.addUserblock(blockType, comment);

    // API Call
    const requestBody = this.user.userValue;
    let request: Request = {
      url: this.userEntity.link, 
      method: HttpMethod.PUT,
      requestBody
    };
    this.restService.call(request)
    .subscribe({
      next: result => {
        /*
        this.eventsService.refreshPage().subscribe(
          ()=>this.alert.success('Success!')
        );
        */
       console.log("done");
      },
      error: (e: RestErrorResponse) => {
       // TODO: this.alert.error('Failed to update data: ' + e.message);
        console.error(e);
      }
    });    
  }

  resetUser(): void {
    this.user = null;
    this._setPrimaryId("");
  }

  private tryParseJson(value: any) {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error(e);
    }
    return undefined;
  }
}
