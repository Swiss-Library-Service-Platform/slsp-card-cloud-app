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

import { AuthorizationResult } from '../services/authorization.service';
import { BackendHttpService } from '../services/backend-http.service';
import {
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let state: jasmine.SpyObj<PatronStateService>;
  let patronState$: BehaviorSubject<PatronState>;
  let authorization$: BehaviorSubject<AuthorizationResult>;
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
    authorization$ = new BehaviorSubject<AuthorizationResult>({
      status: 'allowed',
    });
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
      Errors: {
        AuthenticationFailed: 'Authentication failed.',
        AccessDenied: 'Access denied.',
        InvalidPatronId: 'The selected patron cannot be loaded.',
        PatronNotFound:
          '{{entityDescription}} was not found in the Network Zone.',
        InvalidLibraryCardFormat: 'The card number format is invalid.',
        DuplicateLibraryCardNumber: 'The card number is already in use.',
        UnsupportedBlock: 'The block is unsupported.',
        BlockCommentRequired: 'A block comment is required.',
        StaleSelection: 'The selection is stale.',
        InvalidSettingsNote: 'The shared settings are invalid.',
        UpstreamFailure: 'Service temporarily unavailable',
        DependencyUnavailable: 'Service temporarily unavailable',
        UnexpectedFailure: 'An unexpected error occurred.',
        SelectedPatron: 'The selected patron',
        SupportId: 'Support ID: {{errorId}}',
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
          ? {
              status: 'not-found',
              entity: selected,
              error: {
                type: 'PATRON_NOT_FOUND',
                errorId: '',
                context: {},
              },
            }
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

  it('uses the selected entity and support id for patron-not-found without rendering backend context', async () => {
    const fixture = TestBed.createComponent(MainComponent);

    fixture.detectChanges();
    patronState$.next({
      status: 'not-found',
      entity: selected,
      error: {
        type: 'PATRON_NOT_FOUND',
        errorId: 'support-404',
        context: { entityDescription: 'private backend patron' },
      },
    });
    await fixture.whenStable();

    expect(alert.warn).toHaveBeenCalledOnceWith(
      'Selected user was not found in the Network Zone. Support ID: support-404',
      { autoClose: false },
    );
    expect(alert.warn.calls.mostRecent().args[0]).not.toContain(
      'private backend patron',
    );
  });

  it('presents business conflicts as localized warnings with a support id', async () => {
    const fixture = TestBed.createComponent(MainComponent);

    fixture.detectChanges();
    patronState$.next({
      status: 'error',
      entity: selected,
      error: {
        type: 'STALE_SELECTION',
        errorId: 'support-409',
        context: { detail: 'private backend detail' },
      },
    });
    await fixture.whenStable();

    expect(alert.warn).toHaveBeenCalledOnceWith(
      'The selection is stale. Support ID: support-409',
      { autoClose: false },
    );
    expect(alert.error).not.toHaveBeenCalled();
  });

  it('uses temporary-unavailable copy and support id for transport failures', async () => {
    const fixture = TestBed.createComponent(MainComponent);

    fixture.detectChanges();
    patronState$.next({
      status: 'error',
      entity: selected,
      error: {
        type: 'DEPENDENCY_UNAVAILABLE',
        errorId: 'support-503',
        context: {},
      },
    });
    await fixture.whenStable();

    expect(alert.error).toHaveBeenCalledOnceWith(
      'Service temporarily unavailable Support ID: support-503',
      { autoClose: false },
    );
  });

  it('renders authentication failures as access state and preserves the support alert', async () => {
    const fixture = TestBed.createComponent(MainComponent);

    fixture.detectChanges();
    patronState$.next({
      status: 'error',
      entity: selected,
      error: {
        type: 'AUTHENTICATION_FAILED',
        errorId: 'support-401',
        context: {},
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.institution-now-allowed'),
    ).not.toBeNull();
    expect(alert.error).toHaveBeenCalledOnceWith(
      'Authentication failed. Support ID: support-401',
      { autoClose: false },
    );
    expect(state.clear).not.toHaveBeenCalled();
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

    authorization$.next({
      status: 'denied',
      reason: 'authorization',
      error: {
        type: 'ACCESS_DENIED',
        errorId: 'support-403',
        context: { detail: 'private backend detail' },
      },
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.user-not-allowed'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Required role missing',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Access denied. Support ID: support-403',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'private backend detail',
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
