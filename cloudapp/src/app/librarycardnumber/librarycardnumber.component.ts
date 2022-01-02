import { Component, OnInit, Input } from '@angular/core';
import { Router,ActivatedRoute } from '@angular/router';
import {Location} from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';

@Component({
  selector: 'app-librarycardnumber',
  templateUrl: './librarycardnumber.component.html',
  styleUrls: ['./librarycardnumber.component.scss']
})
export class LibrarycardnumberComponent implements OnInit {
  @Input() primary_id: string;

  constructor(
    private _Activatedroute:ActivatedRoute,
    private _location: Location,
    private _libraryManagementService: LibraryManagementService
  ) { }

    currentFullName: String;
    currentLibraryCardNumbers: Array<string>;
    subscription;
  
  ngOnInit(): void {
    this.subscription = this._libraryManagementService.getUserFullName().subscribe(
      res => {
        this.currentFullName = res;
        this.currentLibraryCardNumbers = this._libraryManagementService.getUserLibraryCardNumbers();
        console.log(this.currentLibraryCardNumbers);
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
