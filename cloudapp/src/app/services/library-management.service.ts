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
      this._setPrimaryId(user.primary_id);
      return true;
    } catch (e: unknown) {
      //TODO: this.alert.error('Failed to retrieve entity: ' + error.message)
      return false;
    }
  }



  resetUser(): void {
    this.user = null;
    this._setPrimaryId("");
  }

  setUserBlock() {
    return true;
  }


}
