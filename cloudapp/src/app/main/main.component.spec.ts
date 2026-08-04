import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertService,
  Entity,
  EntityType,
} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { BackendHttpService } from '../services/backend-http.service';
import {
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let state: jasmine.SpyObj<PatronStateService>;
  let patronState$: BehaviorSubject<PatronState>;
  let router: jasmine.SpyObj<Router>;
  const selected: Entity = {
    id: 'one',
    type: EntityType.USER,
    link: '/users/one',
    description: 'Selected user',
  };

  beforeEach(() => {
    patronState$ = new BehaviorSubject<PatronState>({ status: 'empty' });
    state = jasmine.createSpyObj<PatronStateService>(
      'PatronStateService',
      ['autoSelect', 'select', 'clear'],
      {
        authorization$: of({ status: 'allowed' }),
        userEntities$: of([selected]),
        patronState$,
      },
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        MainComponent,
        { provide: PatronStateService, useValue: state },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { isAutoSelect: 'true' } } },
        },
        {
          provide: BackendHttpService,
          useValue: { isSandbox$: (): Observable<boolean> => of(true) },
        },
        {
          provide: AlertService,
          useValue: jasmine.createSpyObj<AlertService>('AlertService', [
            'warn',
            'error',
          ]),
        },
        {
          provide: TranslateService,
          useValue: { instant: (key: string): string => key },
        },
      ],
    });
  });

  it('configures exact route-driven auto-selection without subscribing manually', () => {
    const component = TestBed.inject(MainComponent);

    component.ngOnInit();

    expect(state.autoSelect).toHaveBeenCalledOnceWith('true');
  });

  it('selects the USER metadata from a radio change', () => {
    const component = TestBed.inject(MainComponent);

    component.entitySelected({ value: selected });

    expect(state.select).toHaveBeenCalledOnceWith(selected);
  });

  it('navigates after the selected Card patron becomes ready', () => {
    const component = TestBed.inject(MainComponent);

    component.ngOnInit();
    patronState$.next({
      status: 'ready',
      entity: selected,
      patron: {
        fullName: 'User One',
        external: false,
        libraryCardNumbers: [],
        matriculationNumber: null,
        dashedMatriculationNumber: null,
        blocks: {},
        postalAddresses: [],
      },
    });

    expect(router.navigate).toHaveBeenCalledOnceWith(['usermenu']);
  });
});
