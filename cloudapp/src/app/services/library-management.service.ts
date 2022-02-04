import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import {
  CloudAppRestService, CloudAppEventsService, Request, HttpMethod,
  Entity, RestErrorResponse, AlertService
} from '@exlibris/exl-cloudapp-angular-lib';
import { User } from '../model/user.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LibraryManagementService {

  public user: User;
  private userEntity: Entity
  private readonly _userObject = new BehaviorSubject<User>(new User());
  httpOptions: {};

  constructor(
    private restService: CloudAppRestService,
    private http: HttpClient,
    private eventsService: CloudAppEventsService,
    private alert: AlertService
  ) {
    this.eventsService.getAuthToken()
      .subscribe(authToken => {
        console.log("gotcha");
        this.httpOptions = {
          headers: new HttpHeaders({
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }),
          withCredentials: true
        };
      });

  }

  getUserObject(): Observable<User> {
    return this._userObject.asObservable();
  }

  private _setObservableUserObject(user: User): void {
    this._userObject.next(user);
  }

  async getUserFromEntity(entity: Entity) {
    this.userEntity = entity;
    return new Promise(resolve => {
      this.http.get(entity.link, this.httpOptions).subscribe(
        userdata => {
          this.user = new User(userdata);
          this._setObservableUserObject(this.user);
          resolve(true);
        },
        error => {

          console.log(error);
          if (error.status == 400) {
            this.alert.error(entity.description + ' was not found in the Network Zone.');

          } else {
            this.alert.error('Service temporarily unavailable');
          }
          resolve(false);
        });
    });
  }

  addUserblock(blockType: String, comment: String = "") {

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

  async addUserLibraryCardNumber(libraryCardNumber: string): Promise<Boolean> {
    // ADD NUMBER TO USER OBJECT
    const isAdded = this.user.addLibraryCardNumber(libraryCardNumber);
    if (!isAdded) return false;
    // API CALL
    return this.updateUser();
  }

  async removeUserLibraryCardNumber(libraryCardNumber: string): Promise<Boolean> {
    // REMOVE NUMBER FROM USER OBJECT
    const isRemoved = this.user.removeLibraryCardNumber(libraryCardNumber);
    if (!isRemoved) return false;
    // API CALL
    return this.updateUser();
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

  async updateUser(): Promise<Boolean> {
    return new Promise(resolve => {
      console.log(this.httpOptions);
      this.http.put(this.userEntity.link, this.user.userValue, this.httpOptions).subscribe(
        userdata => {
          // UPDATE USER
          this.user = new User(userdata);
          this._setObservableUserObject(this.user);
          resolve(true);
        },
        error => {
          resolve(false);
        },
        () => console.log("HTTP Observable completed...")
      );
    });
  }
}
