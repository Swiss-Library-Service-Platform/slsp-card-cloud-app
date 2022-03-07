import { Component, OnInit, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { LibraryManagementService } from '../services/library-management.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-usermenu',
  templateUrl: './usermenu.component.html',
  styleUrls: ['./usermenu.component.scss']
})
export class UsermenuComponent implements OnInit {

  constructor(
    private router: Router,
    private _libraryManagementService: LibraryManagementService,
    private translate: TranslateService,
  ) { }

  currentFullName: String;
  subscription;
  blocksTitle: String;
  settingsTitle: String;
  numbersTitle: String;

  async ngOnInit() {
    this.blocksTitle = await this.translate.get('Main.Block').toPromise();
    this.settingsTitle = await this.translate.get('Main.Settings').toPromise();
    this.numbersTitle = await this.translate.get('Main.LibraryCardNumber').toPromise();

    this.subscription = this._libraryManagementService.getUserObject().subscribe(
      res => {
        this.currentFullName = res.getFullName();
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
    this.router.navigate(['root/false']);
  }


}
