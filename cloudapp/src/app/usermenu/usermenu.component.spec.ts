import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Entity, EntityType } from '@exlibris/exl-cloudapp-angular-lib';
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
            selector: 'block-selector',
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
      providers: [
        UsermenuComponent,
        { provide: PatronStateService, useValue: state },
        { provide: Router, useValue: router },
        {
          provide: BackendHttpService,
          useValue: { isSandbox$: (): Observable<boolean> => of(true) },
        },
      ],
    });
  });

  it('exposes the ready Card DTO as a declarative menu view model', (done) => {
    const component = TestBed.inject(UsermenuComponent);

    component.vm$.subscribe((vm) => {
      expect(vm?.patron.fullName).toBe('Test Patron');
      expect(vm?.hasBlocks).toBeTrue();
      expect(vm?.sandbox).toBeTrue();
      done();
    });
  });

  it('clears Card state before returning to the selection route', () => {
    const component = TestBed.inject(UsermenuComponent);

    component.navigateBack();

    expect(state.clear).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledOnceWith(['root/false']);
  });
});
