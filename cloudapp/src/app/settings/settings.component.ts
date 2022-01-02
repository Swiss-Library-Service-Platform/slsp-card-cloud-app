import { Observable  } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CloudAppRestService, CloudAppEventsService, Request, HttpMethod, 
  Entity, RestErrorResponse, AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { MatRadioChange } from '@angular/material/radio';
import { Router,ActivatedRoute } from '@angular/router';
import {Location} from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';

@Component({
  selector: 'app-main',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {


  selected = 'Lol';

  constructor(
    private restService: CloudAppRestService,
    private eventsService: CloudAppEventsService,
    private alert: AlertService,
    private _Activatedroute:ActivatedRoute,
    private _location: Location,
    private _libraryManagementService: LibraryManagementService
  ) { }
  
  currentFullName: String;
  currentUserAddresses: Array<Object>;
  subscription;

  ngOnInit(): void {
    this.subscription = this._libraryManagementService.getUserFullName().subscribe(
      res => {
        this.currentFullName = res;
        this.currentUserAddresses = this._libraryManagementService.user.getAddresses();
        console.log(this.currentUserAddresses);
      },
      err => {
        console.error(`An error occurred: ${err.message}`);
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }


  navigateBack(): void {
    this._location.back();
  }

}