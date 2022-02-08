import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import {
  CloudAppRestService, CloudAppEventsService, Request, HttpMethod,
  Entity, RestErrorResponse, AlertService
} from '@exlibris/exl-cloudapp-angular-lib';
import { MatRadioChange } from '@angular/material/radio';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {

  constructor(
    private alert: AlertService,
    private _Activatedroute: ActivatedRoute,
    private _location: Location,
    private _libraryManagementService: LibraryManagementService
  ) { }

  currentFullName: String;
  currentUserAddresses: Array<Object>;
  subscription;
  loading: Boolean;

  ngOnInit(): void {
    this.subscription = this._libraryManagementService.getUserObject().subscribe(
      res => {
        console.log("initing");
        this.currentFullName = res.getFullName();
        this.currentUserAddresses = this._libraryManagementService.getUserAddresses();
      },
      err => {
        console.error(`An error occurred: ${err.message}`);
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  async changePreferredAddress(address: Object): Promise<void> {
    this.loading = true;
    const isAdded = await this._libraryManagementService.setUserPreferredAddress(address);
    if (!isAdded) {
      this.alert.error("Preferred address could not be changed.", { autoClose: true });
    } else {
      this.alert.success("Preferred address changed successfully.");
    }
    this.loading = false;
  }

  navigateBack(): void {
    this._location.back();
  }

}