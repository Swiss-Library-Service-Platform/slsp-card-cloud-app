import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable  } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { Component, OnInit, OnDestroy} from '@angular/core';
import { CloudAppRestService, CloudAppEventsService, Request, HttpMethod, 
  Entity, RestErrorResponse, AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { User } from '../model/user.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LibraryManagementService {

  public user:User;
  private userEntity:Entity
  private readonly _userObject = new BehaviorSubject<User>(Object());

  constructor(
    private restService: CloudAppRestService,
    private http: HttpClient
  ) { }

  getUserObject(): Observable<User> {
    return this._userObject.asObservable();
  }

  private _setObservableUserObject(user: User): void {
    this._userObject.next(user);
  }

  async getUserFromEntity (entity: Entity) {
    // TODO: Network zone
    
    try {
//      const userdata = await this.restService.call<any>(entity.link).toPromise();
      const userdata = await this.http.get('https://proxy01.swisscovery.network/almaws/v1').toPromise();

      //proxy01.swisscovery.ch
      this.user = new User(userdata);
      this.userEntity = entity;
      this._setObservableUserObject(this.user);
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

  getUserAddresses() {
    return this.user.getAddresses();
  }

  getUserLibraryCardNumbers() {
    return this.user.getLibraryCardNumbers();
  }

  addUserLibraryCardNumber(libraryCardNumber: string) {
    this.user.addLibraryCardNumber(libraryCardNumber);
    // CHECK IF ANOTHER USER EXISTS

    // API CALL

    // UPDATE USER
    this._setObservableUserObject(this.user);
  }

  removeUserLibraryCardNumber(libraryCardNumber: string) {
    this.user.removeLibraryCardNumber(libraryCardNumber);
    // API CALL

    // UPDATE USER
    this._setObservableUserObject(this.user);
  }

  setUserPreferredAddress(address: Object) {
    this.user.setPreferredAddress(address);
    // API CALL

    // UPDATE USER
    this._setObservableUserObject(this.user);
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
