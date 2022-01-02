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
  private readonly _primaryid = new BehaviorSubject<String>("");;
  private readonly _fullname = new BehaviorSubject<String>("");;

  constructor(
    private restService: CloudAppRestService,
    private http: HttpClient
  ) { }

  // Expose the observable$ part of the _todos subject (read only stream)
  getUserFullName(): Observable<String> {
    return this._fullname.asObservable();
  }

  private _setFullName(full_name: string): void {
    this._fullname.next(full_name);
  }

  async getUserFromEntity (entity: Entity) {
    // TODO: Network zone
    
    try {
      const userdata = await this.restService.call<any>(entity.link).toPromise();
      
      this.user = new User(userdata);
      this.userEntity = entity;
      this._setFullName(this.user.getFullName());
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
    // API Call
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
