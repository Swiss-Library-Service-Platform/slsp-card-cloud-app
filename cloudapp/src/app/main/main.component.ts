import { Observable } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  CloudAppRestService, CloudAppEventsService, Request, HttpMethod,
  Entity, RestErrorResponse, AlertService, EntityType
} from '@exlibris/exl-cloudapp-angular-lib';
import { MatRadioChange } from '@angular/material/radio';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { LibraryManagementService } from '../services/library-management.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, OnDestroy {
  loading = false;
  selectedEntity: Entity;
  apiResult: any;
  isAutoSelect: string;
  isUserHasRole: boolean = false;
  isUserCheckDone: boolean = false;
  isInstitutionAllowed: boolean = false;
  isProdEnvironment: boolean = true;

  entities$: Observable<Entity[]> = this.eventsService.entities$
    .pipe(
      tap(() => this.clear()),
      map(entities => {
        return entities.filter(e => e.type == EntityType.USER);
      }),
    )


  constructor(
    private _libraryManagementService: LibraryManagementService,
    private eventsService: CloudAppEventsService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  async ngOnInit() {
    this.loading = true;
    let initData = await this.eventsService.getInitData().toPromise();
    let regExp = new RegExp('^https.*-psb.*com$|.*localhost.*'), // contains "PSB" (Premium Sandbox) or "localhost"
      currentUrl = initData["urls"]["alma"];
    this.isProdEnvironment = !regExp.test(currentUrl);

    await this._libraryManagementService.init(initData, this.isProdEnvironment);
    // check if current institution is allowed to use this cloud app
    this.isInstitutionAllowed = await this._libraryManagementService.getIsCurrentInstitutionAllowed();
    // check if current user has a role
    if (this.isInstitutionAllowed) {
      this.isUserHasRole = await this._libraryManagementService.getIsCurrentUserAllowed();
    }
    this.isUserCheckDone = true;
    // auto select the user if only one user is visible
    if (this.isUserHasRole) {
      if (this.route.snapshot.params.isAutoSelect == 'true') {
        this.entities$.subscribe(async (availableEntities) => {
          if (availableEntities.length == 1) {
            await this.setUser(availableEntities[0]);
          }
          this.loading = false;
        });
      } else {
        this.loading = false;
      }
    } else {
      this.loading = false;
    }

  }

  ngOnDestroy(): void {
  }

  async entitySelected(event: MatRadioChange) {
    const value = event.value as Entity;
    this.loading = true;
    await this.setUser(value);
    this.loading = false
  }

  clear() {
    this.apiResult = null;
    this.selectedEntity = null;
  }

  async setUser(entity: Entity) {
    const userFound = await this._libraryManagementService.getUserFromEntity(entity);
    if (userFound) {
      this.router.navigate(['usermenu'])
    } else {
      this.clear();
    }
  }
}