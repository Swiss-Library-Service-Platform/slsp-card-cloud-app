import { Component, OnInit, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';
import { User } from '../model/user.model';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { Librarycardnumber } from '../model/librarycardnumber.model';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmationdialogComponent } from '../confirmationdialog/confirmationdialog.component';

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
    private dialog: MatDialog
  ) { }
  loading = false;
  currentFullName: String;
  currentLibraryCardNumbers: Array<string>;
  subscription;
  newLibraryCardNumber: string = '';
  dialogRef: MatDialogRef<ConfirmationdialogComponent>;

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

  async deleteLibraryCardNumber(libraryCardNumber: string): Promise<void> {
    this.dialogRef = this.dialog.open(ConfirmationdialogComponent, {
      disableClose: false
    });
    this.dialogRef.componentInstance.confirmMessage = "Are you sure you want to remove this number?"

    this.dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        this.loading = true;
        const isRemoved = await this._libraryManagementService.removeUserLibraryCardNumber(libraryCardNumber);
        if (!isRemoved) {
          this.alert.error("Library card number could not be removed.");
        } else {
          this.alert.success("Library card successfully removed.");
        }
        this.loading = false;
      }
      this.dialogRef = null;
    });

  }

  async addLibraryCardNumber(): Promise<void> {
    this.loading = true;
    const isAdded = await this._libraryManagementService.addUserLibraryCardNumber(this.newLibraryCardNumber);
    if (!isAdded) {
      this.alert.error("Library card number is probably not valid.", { autoClose: true });
    } else {
      this.newLibraryCardNumber = '';
      this.alert.success("Library card successfully added.");
    }
    this.loading = false;
  }
}


