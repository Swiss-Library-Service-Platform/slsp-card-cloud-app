import { Observable, Subscription } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import {
  CloudAppRestService,
  CloudAppEventsService,
  Request,
  HttpMethod,
  Entity,
  RestErrorResponse,
  AlertService,
} from '@exlibris/exl-cloudapp-angular-lib';
import { MatRadioChange } from '@angular/material/radio';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';
import { User } from '../model/user.model';
import { ElementRef, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['block.component.scss'],
})
export class BlockComponent implements OnInit, OnDestroy {
  @Input() primary_id: string;

  constructor(
    private _libraryManagementService: LibraryManagementService,
    private eventsService: CloudAppEventsService,
    private alert: AlertService,
    private _location: Location,
    private translate: TranslateService,
  ) {}
  currentFullName: string;
  currentUser: User = null;
  currentUserBlocks: Map<string, any> = null;
  subscription = new Subscription();
  collapsedDouble = true;
  collapsedWrongPostal = true;
  collapsedWrongEmail = true;
  collapseGlobal = true;
  collapsedNew = true;
  commentDouble = '';
  commentWrongPostal = '';
  commentWrongEmail = '';
  commentGlobal = '';
  loading: boolean;

  ngOnInit(): void {
    this.subscription = this._libraryManagementService
      .getUserObject()
      .subscribe(
        (res) => {
          this.currentFullName = res.getFullName();
          this.currentUser = res;
          this.currentUserBlocks =
            this._libraryManagementService.user.getUserBlocks();
        },
        (err) => {
          console.error(`An error occurred: ${err.message}`);
        },
      );
  }

  async addUserBlock(blockType: string, comment: string): Promise<void> {
    if (blockType == '09' && !comment) {
      this.alert.error('Comment must not be empty on global block!', {
        autoClose: false,
      });

      return;
    }
    this.loading = true;

    const isAdded = await this._libraryManagementService.addUserblock(
      blockType,
      comment,
    );

    if (!isAdded) {
      const errMessage = await this.translate
        .get('Blocks.AddError')
        .toPromise();

      this.alert.error(errMessage, { autoClose: false });
    } else {
      const succMessage = await this.translate
        .get('Blocks.AddSuccess')
        .toPromise();

      this.alert.success(succMessage, { autoClose: false });
    }
    this.loading = false;
  }

  async removeUserBlock(blockType: string): Promise<void> {
    this.loading = true;

    const isRemoved =
      await this._libraryManagementService.removeUserblock(blockType);

    if (!isRemoved) {
      const errMessage = await this.translate
        .get('Blocks.RemoveError')
        .toPromise();

      this.alert.error(errMessage, { autoClose: false });
    } else {
      const succMessage = await this.translate
        .get('Blocks.RemoveSuccess')
        .toPromise();

      this.alert.success(succMessage, { autoClose: false });
    }
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  navigateBack(): void {
    this._location.back();
  }

  getDateString(date: string): string {
    return new Date(date).toUTCString();
  }
}
