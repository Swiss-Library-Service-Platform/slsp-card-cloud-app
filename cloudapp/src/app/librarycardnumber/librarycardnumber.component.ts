import { Component, OnInit, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';
import { libraryCardValidator } from '../validators/librarycardnumber.validator';
import { AlertService, CloudAppEventsService } from '@exlibris/exl-cloudapp-angular-lib';
import { Librarycardnumber } from '../model/librarycardnumber.model';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmationdialogComponent } from '../confirmationdialog/confirmationdialog.component';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
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
    private dialog: MatDialog,
    private formBuilder: FormBuilder,
    private eventsService: CloudAppEventsService,
    private translate: TranslateService
  ) { }
  loading = false;
  currentFullName: String;
  currentLibraryCardNumbers: Array<string>;
  currentMatriculationNumber: string;
  subscription;
  newLibraryCardNumber: string = '';
  dialogRef: MatDialogRef<ConfirmationdialogComponent>;

  numberForm = this.formBuilder.group({
    newLibraryCardNumber: new FormControl('', {
      validators: [libraryCardValidator],
      updateOn: 'change'
    })
  });

  ngOnInit(): void {
    this.subscription = this._libraryManagementService.getUserObject().subscribe(
      res => {
        this.currentFullName = res.getFullName();
        this.currentLibraryCardNumbers = this._libraryManagementService.getUserLibraryCardNumbers();
        this.currentMatriculationNumber = this._libraryManagementService.getUserMatriculationNumber();
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
    let initData = await this.eventsService.getInitData().toPromise();
    let libaryCardNumber = this.numberForm.controls['newLibraryCardNumber'].value;
    if (!this.numberForm.valid) {
      this.alert.error("Format of library card number is not valid.", { autoClose: true });
      return;
    }
    this.loading = true;
    const isAdded = await this._libraryManagementService.addUserLibraryCardNumber(libaryCardNumber, initData.user.primaryId, initData.instCode);
    if (!isAdded) {
      this.alert.error("Library card number is not valid or already in use.", { autoClose: true });
    } else {
      this.numberForm.controls['newLibraryCardNumber'].setValue('');
      this.alert.success("Library card successfully added.", { autoClose: true });
    }
    this.loading = false;
  }

  isNumberRemovable(libraryCardNumber: Object): Boolean {
    return Librarycardnumber.isRemovable(libraryCardNumber);
  }

  isNumberDashedLibraryCardNumber(libraryCardNumber: Object): Boolean {
    return Librarycardnumber.isDashedLibraryCardNumber(libraryCardNumber);
  }
}


