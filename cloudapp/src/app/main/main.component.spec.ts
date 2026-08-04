import { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertService,
  Entity,
  EntityType,
  MaterialModule,
} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { BackendHttpService } from '../services/backend-http.service';
import {
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let state: jasmine.SpyObj<PatronStateService>;
  let patronState$: BehaviorSubject<PatronState>;
  let authorization$: BehaviorSubject<
    | { readonly status: 'allowed' }
    | {
        readonly status: 'denied';
        readonly reason: 'authentication' | 'authorization';
      }
    | { readonly status: 'error'; readonly error: unknown }
  >;
  let entities$: BehaviorSubject<readonly Entity[]>;
  let sandbox$: BehaviorSubject<boolean>;
  let router: jasmine.SpyObj<Router>;
  let alert: jasmine.SpyObj<AlertService>;
  let autoSelect$: Subject<void>;
  const selected: Entity = {
    id: 'one',
    type: EntityType.USER,
    link: '/users/one',
    description: 'Selected user',
  };

  beforeEach(() => {
    patronState$ = new BehaviorSubject<PatronState>({ status: 'empty' });
    authorization$ = new BehaviorSubject<
      | { readonly status: 'allowed' }
      | {
          readonly status: 'denied';
          readonly reason: 'authentication' | 'authorization';
        }
      | { readonly status: 'error'; readonly error: unknown }
    >({ status: 'allowed' });
    entities$ = new BehaviorSubject<readonly Entity[]>([selected]);
    sandbox$ = new BehaviorSubject(true);
    autoSelect$ = new Subject<void>();
    state = jasmine.createSpyObj<PatronStateService>(
      'PatronStateService',
      ['autoSelect$', 'select', 'clear'],
      {
        authorization$,
        userEntities$: entities$,
        patronState$,
      },
    );
    state.autoSelect$.and.returnValue(autoSelect$);
    state.clear.and.callFake(() => patronState$.next({ status: 'empty' }));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    alert = jasmine.createSpyObj<AlertService>('AlertService', [
      'warn',
      'error',
    ]);

    TestBed.configureTestingModule({
      declarations: [MainComponent],
      imports: [
        BrowserAnimationsModule,
        MaterialModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: PatronStateService, useValue: state },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { isAutoSelect: 'true' } } },
        },
        {
          provide: BackendHttpService,
          useValue: { isSandbox$: (): Observable<boolean> => sandbox$ },
        },
        { provide: AlertService, useValue: alert },
      ],
    });

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      Welcome: {
        Welcome: 'Welcome to SLSP Card!',
        LetsGo: "Let's get started",
        Instructions1: 'Search for a user',
        Instructions2: 'Open the app',
        Instructions3: 'Select the user',
        AccessDenied: 'Access denied',
        InstitutionDenied1: 'Institution unavailable ',
        InstitutionDenied2: 'contact SLSP',
        InstitutionDenied3: ' for help.',
        NoRole: 'Required role missing',
        Fulfillment: 'Fulfillment Services Manager',
        UserManager: 'User Manager',
        GeneralSystem: 'General System Administrator',
        SelectUser: 'Select a user:',
      },
      Main: {
        UserNotFound: ' was not found in the Network Zone.',
        TemporarilyUnavailable: 'Service temporarily unavailable',
      },
    });
    translate.use('en');
  });

  it('starts exact route-driven auto-selection', () => {
    const component = TestBed.createComponent(MainComponent).componentInstance;

    component.ngOnInit();

    expect(state.autoSelect$).toHaveBeenCalledOnceWith('true');
  });

  it('selects the USER metadata from a radio change', () => {
    const component = TestBed.createComponent(MainComponent).componentInstance;

    component.entitySelected({ value: selected });

    expect(state.select).toHaveBeenCalledOnceWith(selected);
  });

  it('navigates after the selected Card patron becomes ready', async () => {
    const fixture = TestBed.createComponent(MainComponent);
    const component = fixture.componentInstance;

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
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledOnceWith(['usermenu']);
  });

  ['not-found', 'error'].forEach((status) => {
    it(`alerts once and clears selection after a terminal ${status} state`, async () => {
      const fixture = TestBed.createComponent(MainComponent);

      fixture.detectChanges();

      const terminalState: PatronState =
        status === 'not-found'
          ? { status: 'not-found', entity: selected }
          : {
              status: 'error',
              entity: selected,
              error: {
                type: 'DEPENDENCY_UNAVAILABLE',
                errorId: '',
                context: {},
              },
            };

      patronState$.next(terminalState);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(state.clear).toHaveBeenCalledTimes(1);
      expect(patronState$.value).toEqual({ status: 'empty' });
      expect(alert.warn.calls.count() + alert.error.calls.count()).toBe(1);
      expect(
        fixture.nativeElement.querySelector('mat-radio-group'),
      ).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Select a user:');
    });
  });

  it('owns and disposes the bounded auto-select effect with the component lifecycle', () => {
    const fixture = TestBed.createComponent(MainComponent);

    fixture.detectChanges();
    expect(autoSelect$.observers.length).toBe(1);

    fixture.destroy();
    expect(autoSelect$.observers.length).toBe(0);
  });

  it('renders authorization guidance, sandbox state, loading, and translated selection controls', () => {
    const fixture: ComponentFixture<MainComponent> =
      TestBed.createComponent(MainComponent);

    authorization$.next({ status: 'denied', reason: 'authorization' });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.user-not-allowed'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Required role missing',
    );
    expect(
      fixture.nativeElement.querySelector('.info-test-env'),
    ).not.toBeNull();

    authorization$.next({ status: 'allowed' });
    patronState$.next({ status: 'loading', entity: selected });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-spinner')).not.toBeNull();

    patronState$.next({ status: 'empty' });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('mat-radio-group'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Selected user');
    expect(fixture.nativeElement.textContent).toContain('Select a user:');
  });
});
