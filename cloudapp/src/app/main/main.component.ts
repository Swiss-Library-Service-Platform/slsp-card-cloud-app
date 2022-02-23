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
    await this._libraryManagementService.init();
    // TODO: check if current institution is allowed to use this cloud app
    this.isInstitutionAllowed = true;
    // check if current user has a role
    let initData = await this.eventsService.getInitData().toPromise();
    const isUserAllowed = this._libraryManagementService.getIsCurrentUserAllowed(initData.user.primaryId);
    this.isUserCheckDone = true;
    if (!isUserAllowed) {
      this.isUserHasRole = false;
    } else {
      this.isUserHasRole = true;
      // auto select the user if only one user is visible
      this.route.params.subscribe((params: Params) => this.isAutoSelect = params['isAutoSelect']);
      if (this.isAutoSelect == 'true') {
        this.eventsService.entities$.subscribe((availableEntities) => {
          if (availableEntities.length == 1) {
            this.setUser(availableEntities[0]);
          }
        });
      }
    }
    this.loading = false;

  }

  ngOnDestroy(): void {
  }

  async entitySelected(event: MatRadioChange) {
    const value = event.value as Entity;
    this.setUser(value);
  }

  clear() {
    this.apiResult = null;
    this.selectedEntity = null;
  }

  async setUser(entity: Entity) {
    this.loading = true;
    const userFound = await this._libraryManagementService.getUserFromEntity(entity);
    this.loading = false
    if (userFound) {
      this.router.navigate(['usermenu'])
    } else {
      this.clear();
    }
  }
}