import { Component, OnInit, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';
import { User } from '../model/user.model';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { Librarycardnumber } from '../model/librarycardnumber.model';

@Component({
  selector: 'app-librarycardnumber',
  templateUrl: './librarycardnumber.component.html',
  styleUrls: ['./librarycardnumber.component.scss']
})
export class LibrarycardnumberComponent implements OnInit {
  @Input() primary_id: string;

  constructor(
    private _Activatedroute: ActivatedRoute,
    private _location: Location,
    private _libraryManagementService: LibraryManagementService,
    private alert: AlertService,
  ) { }
  loading = false;
  currentFullName: String;
  currentLibraryCardNumbers: Array<string>;
  subscription;
  newLibraryCardNumber: string = '';

  ngOnInit(): void {
    this.subscription = this._libraryManagementService.getUserObject().subscribe(
      res => {
        this.currentFullName = res.getFullName();
        this.currentLibraryCardNumbers = this._libraryManagementService.getUserLibraryCardNumbers();
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

  deleteLibraryCardNumber(libraryCardNumber: string): void {
    this.loading = true;
    this._libraryManagementService.removeUserLibraryCardNumber(libraryCardNumber);
    this.loading = false;
  }

  async addLibraryCardNumber(): Promise<void> {
    this.loading = true;
    const isAdded = await this._libraryManagementService.addUserLibraryCardNumber(this.newLibraryCardNumber);
    if (!isAdded) {
      this.alert.error("Library card number is probably not valid.", { autoClose: true });
    } else {
      this.newLibraryCardNumber = '';
    }
    this.loading = false;
  }
}


