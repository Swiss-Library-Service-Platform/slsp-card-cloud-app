import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CloudAppEventsService, Entity, AlertService, CloudAppRestService } from '@exlibris/exl-cloudapp-angular-lib';
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
    private restService: CloudAppRestService,
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
   * Checks wheter the currently loggedin user has sufficient permissions
   *
   * @param {string} primaryId of currently loggedin user
   * @return {Boolean} 
   * @memberof LibraryManagementService
   */
  async getIsCurrentUserAllowed(primaryId: string): Promise<boolean> {
    let user = await this.restService.call<any>('/users/' + primaryId).toPromise();
    // 26 (General System Administrator)
    // 52 (Fulfillment Administrator)
    // 21 (User Manager)
    const requiredRoles = ['26', '52', '21'];
    let isAllowed = false;
    for (let userrole of user.user_role) {
      if (requiredRoles.indexOf(userrole.role_type.value) != -1 &&
        userrole.status.value == 'ACTIVE') {
        isAllowed = true;
        break;
      }

    }
    return isAllowed;
  }

  /**
   * Checks wheter the current instition is allowed to use this cloudapp
   *
   * @param {string} primaryId of currently loggedin user
   * @return {Boolean} 
   * @memberof LibraryManagementService
   */
  async getIsCurrentInstitutionAllowed(institutionId: string): Promise<boolean> {
    return new Promise(resolve => {
      this.http.get('isAllowed/' + institutionId, this.httpOptions).subscribe(
        isAllowed => {
          // RETURN boolean
          resolve(!!isAllowed);
        },
        error => {
          console.log(error);
          resolve(false);
        },
      );
    });
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
      this.http.get('p/api-eu.hosted.exlibrisgroup.com/almaws/v1' + entity.link, this.httpOptions).subscribe(
        userdata => {
          this.user = new User(userdata);
          this._setObservableUserObject(this.user);
          resolve(true);
        },
        async error => {
          if (error.status == 400) {
            let errMessage = await this.translate.get('Main.UserNotFound').toPromise();
            this.alert.warn(entity.description + errMessage);
          } else {
            let errMessage = await this.translate.get('Main.TemporarilyUnavailable').toPromise();
            this.alert.error(errMessage, { autoClose: true, delay: 10000 });
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
      this.http.put('p/api-eu.hosted.exlibrisgroup.com/almaws/v1' + this.userEntity.link, this.user.userValue, this.httpOptions).subscribe(
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
