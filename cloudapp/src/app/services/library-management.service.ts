import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CloudAppEventsService, Entity, AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { User } from '../model/user.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

/**
 * Service which is responsible for all outgoing API calls in this cloud app
 *
 * @export
 * @class LibraryManagementService
 */
@Injectable({
  providedIn: 'root'
})
export class LibraryManagementService {

  public user: User;
  private userEntity: Entity
  private readonly _userObject = new BehaviorSubject<User>(new User());
  httpOptions: {};

  constructor(
    private http: HttpClient,
    private eventsService: CloudAppEventsService,
    private alert: AlertService,
    private translate: TranslateService
  ) { }

  /**
   * Initializes service
   * Gets the Alma Auth Token and defined HTTPOptions
   *
   * @return {*}  {Promise<void>}
   * @memberof LibraryManagementService
   */
  async init(): Promise<void> {
    let authToken = await this.eventsService.getAuthToken().toPromise();
    this.httpOptions = {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }),
      withCredentials: true
    };
  }

  /**
   * Get the user object as observable
   *
   * @return {*}  {Observable<User>}
   * @memberof LibraryManagementService
   */
  getUserObject(): Observable<User> {
    return this._userObject.asObservable();
  }

  /**
   * Sets the observable user object so that listeners get notified
   *
   * @private
   * @param {User} user
   * @memberof LibraryManagementService
   */
  private _setObservableUserObject(user: User): void {
    this._userObject.next(user);
  }

  /**
   * Returns all user addresses
   *
   * @return {*} 
   * @memberof LibraryManagementService
   */
  getUserAddresses() {
    return this.user.getAddresses();
  }

  /**
   * Returns Library card numbers of user
   *
   * @return {*} 
   * @memberof LibraryManagementService
   */
  getUserLibraryCardNumbers() {
    return this.user.getLibraryCardNumbers();
  }

  /**
   * Returns the User Matriculation Number
   *
   * @return {*} 
   * @memberof LibraryManagementService
   */
  getUserMatriculationNumber() {
    return this.user.getMatriculationNumber();
  }

  /**
   * Gets the Alma user entity and sets the observable user object
   *
   * @param {Entity} entity
   * @return {*} 
   * @memberof LibraryManagementService
   */
  async getUserFromEntity(entity: Entity) {
    this.userEntity = entity;
    return new Promise(resolve => {
      this.http.get(entity.link, this.httpOptions).subscribe(
        userdata => {
          this.user = new User(userdata);
          this._setObservableUserObject(this.user);
          resolve(true);
        },
        async error => {
          if (error.status == 400) {
            let errMessage = await this.translate.get('Main.UserNotFound').toPromise();
            this.alert.error(entity.description + errMessage);
          } else {
            let errMessage = await this.translate.get('Main.TemporarilyUnavailable').toPromise();
            this.alert.error(errMessage, { autoClose: true });
          }
          resolve(false);
        });
    });
  }

  /**
   * Adds a block to a user and calls the update API
   *
   * @param {String} blockType
   * @param {String} [comment=""]
   * @param {String} libCode
   * @param {String} url
   * @return {*}  {Promise<Boolean>}
   * @memberof LibraryManagementService
   */
  addUserblock(blockType: String, comment: String = "", libCode: String, url: String): Promise<Boolean> {
    // ADD USER BLOCK
    this.user.addBlock(blockType, comment, libCode, url);
    // API CALL
    return this.updateUser();
  }

  /**
   * Removes a block from a user and calls the update API
   *
   * @param {String} blockType
   * @return {*}  {Promise<Boolean>}
   * @memberof LibraryManagementService
   */
  removeUserblock(blockType: String): Promise<Boolean> {
    // REMOVE USER BLOCK
    this.user.removeBlock(blockType);
    // API CALL
    return this.updateUser();
  }

  /**
   * Adds a Library Card number to a user and calls the update API
   *
   * @param {string} libraryCardNumber
   * @param {string} primaryId
   * @param {string} instCode
   * @return {*}  {Promise<Boolean>}
   * @memberof LibraryManagementService
   */
  async addUserLibraryCardNumber(libraryCardNumber: string, primaryId: string, instCode: string): Promise<Boolean> {
    // ADD NUMBER TO USER OBJECT
    const isAdded = this.user.addLibraryCardNumber(libraryCardNumber, primaryId, instCode);
    if (!isAdded) return false;
    // API CALL
    return this.updateUser();
  }

  /**
   * Removes a Library Card Number from a user and calls the update API
   *
   * @param {string} libraryCardNumber
   * @return {*}  {Promise<Boolean>}
   * @memberof LibraryManagementService
   */
  async removeUserLibraryCardNumber(libraryCardNumber: string): Promise<Boolean> {
    // REMOVE NUMBER FROM USER OBJECT
    const isRemoved = this.user.removeLibraryCardNumber(libraryCardNumber);
    if (!isRemoved) return false;
    // API CALL
    return this.updateUser();
  }

  /**
   * Sets the preferred address of a user and calls the update API
   *
   * @param {Object} address
   * @param {string} url
   * @return {*}  {Promise<Boolean>}
   * @memberof LibraryManagementService
   */
  async setUserPreferredAddress(address: Object, url: string): Promise<Boolean> {
    // SET PREFERRED ADDRESS
    const isChanged = this.user.setPreferredAddress(address, url);
    // API CALL
    if (!isChanged) return false;
    // UPDATE USER
    return this.updateUser();
  }

  /**
   * Updates the user via Alma NZ API (via proxy02.swisscovery.network)
   *
   * @return {*}  {Promise<Boolean>}
   * @memberof LibraryManagementService
   */
  async updateUser(): Promise<Boolean> {
    return new Promise(resolve => {
      this.http.put(this.userEntity.link, this.user.userValue, this.httpOptions).subscribe(
        userdata => {
          // UPDATE USER
          this.user = new User(userdata);
          this._setObservableUserObject(this.user);
          resolve(true);
        },
        error => {
          console.log(error);
          // RESTORE OLD USER ENTITY
          this.getUserFromEntity(this.userEntity);
          resolve(false);
        },
      );
    });
  }
}
