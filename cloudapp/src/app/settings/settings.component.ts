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
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {

  constructor(
    private alert: AlertService,
    private translate: TranslateService,
    private _location: Location,
    private _libraryManagementService: LibraryManagementService,
    private eventsService: CloudAppEventsService
  ) { }

  currentFullName: String;
  currentUserAddresses: Array<Object>;
  subscription;
  loading: Boolean;

  ngOnInit() {
    this.subscription = this._libraryManagementService.getUserObject().subscribe(
      res => {
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
    let initData = await this.eventsService.getInitData().toPromise();
    this.loading = true;
    const isAdded = await this._libraryManagementService.setUserPreferredAddress(address, initData.urls.alma);
    if (!isAdded) {
      let errMessage = await this.translate.get('Settings.SetError').toPromise();
      this.alert.error(errMessage);
    } else {
      let succMessage = await this.translate.get('Settings.SetSuccess').toPromise();
      this.alert.success(succMessage);
    }
    this.loading = false;
  }

  navigateBack(): void {
    this._location.back();
  }

}