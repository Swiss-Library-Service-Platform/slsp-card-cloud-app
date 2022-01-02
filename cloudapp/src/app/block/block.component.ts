import { Observable  } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CloudAppRestService, CloudAppEventsService, Request, HttpMethod, 
  Entity, RestErrorResponse, AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { MatRadioChange } from '@angular/material/radio';
import { Router,ActivatedRoute } from '@angular/router';
import {Location} from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';
import { User } from '../model/user.model';

@Component({
  selector: 'app-main',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss']
})
export class BlockComponent implements OnInit, OnDestroy {

  @Input() primary_id: string;

  constructor(
    private _libraryManagementService: LibraryManagementService,
    private eventsService: CloudAppEventsService,
    private alert: AlertService,
    private _Activatedroute:ActivatedRoute,
    private _location: Location
  ) { }
  
  currentFullName: String;
  currentUser: User = null;
  currentUserBlocks: Map<String, any>= null;
  subscription;

  ngOnInit(): void {
    this.subscription = this._libraryManagementService.getUserFullName().subscribe(
      res => {
        this.currentFullName = res;
        this.currentUser = this._libraryManagementService.user;
        this.currentUserBlocks = this._libraryManagementService.user.getUserBlocks();
      },
      err => {
        console.error(`An error occurred: ${err.message}`);
      }
    );
  }

  addUserBlock(blockType: String): void {
    this._libraryManagementService.addUserblock(blockType, "Test");
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  navigateBack(): void {
    this._location.back();
  }

  getDateString(date: string): String {
    return new Date(date).toUTCString();
  }

}