import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import {
  Entity,
  EntityType,
  MaterialModule,
} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { BackendHttpService } from '../services/backend-http.service';
import {
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';
import { UsermenuComponent } from './usermenu.component';

describe('UsermenuComponent', () => {
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
    patronState$ = new BehaviorSubject<PatronState>({
      status: 'ready',
      entity: selected,
      patron: {
        fullName: 'Test Patron',
        external: false,
        libraryCardNumbers: [],
        matriculationNumber: null,
        dashedMatriculationNumber: null,
        blocks: {
          '02': {
            code: '02',
            createdDate: null,
            expiryDate: null,
            note: null,
            elementReference: 'block-reference',
          },
        },
        postalAddresses: [],
      },
    });
    state = jasmine.createSpyObj<PatronStateService>(
      'PatronStateService',
      ['clear'],
      { patronState$ },
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      declarations: [UsermenuComponent],
      imports: [
        BrowserAnimationsModule,
        MaterialModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: PatronStateService, useValue: state },
        { provide: Router, useValue: router },
        {
          provide: BackendHttpService,
          useValue: { isSandbox$: (): Observable<boolean> => of(true) },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      General: { BackToMenu: 'Back' },
      Main: {
        LibraryCardNumber: 'Card Number',
        Block: 'Blocks',
        Settings: 'Others',
        PleaseNote: 'Please note:',
        TakesAFewMinutes: 'Changes take a few minutes.',
      },
    });
    translate.use('en');
  });

  it('exposes the ready Card DTO as a declarative menu view model', (done) => {
    const component =
      TestBed.createComponent(UsermenuComponent).componentInstance;

    component.vm$.subscribe((vm) => {
      expect(vm?.patron.fullName).toBe('Test Patron');
      expect(vm?.hasBlocks).toBeTrue();
      expect(vm?.sandbox).toBeTrue();
      done();
    });
  });

  it('clears Card state before returning to the selection route', () => {
    const component =
      TestBed.createComponent(UsermenuComponent).componentInstance;

    component.navigateBack();

    expect(state.clear).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledOnceWith(['root/false']);
  });

  it('renders a loading fallback for route handoff and direct-entry states', () => {
    patronState$.next({ status: 'loading', entity: selected });

    const fixture = TestBed.createComponent(UsermenuComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-spinner')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Test Patron');
  });

  it('renders the sandbox banner, ready header, warning tab, stretched tabs, and translated labels', () => {
    const fixture = TestBed.createComponent(UsermenuComponent);

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.info-test-env'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.user-header-text').textContent,
    ).toContain('Test Patron');
    expect(
      fixture.nativeElement.querySelector('.blocks-tab-icon'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.mat-mdc-tab-group-stretch-tabs'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Back');
    expect(fixture.nativeElement.textContent).toContain('Card Number');
    expect(fixture.nativeElement.textContent).toContain('Blocks');
    expect(fixture.nativeElement.textContent).toContain('Others');
  });
});
