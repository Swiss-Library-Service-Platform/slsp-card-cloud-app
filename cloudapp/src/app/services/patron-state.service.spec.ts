import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import {
  CloudAppEventsService,
  Entity,
  EntityType,
} from '@exlibris/exl-cloudapp-angular-lib';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';

import { CardApiError, CardPatron } from '../models/card-api.model';
import { AuthorizationService } from './authorization.service';
import { PatronApiService } from './patron-api.service';
import {
  PatronState,
  PatronStateService,
  extractPatronId,
} from './patron-state.service';

const patron = (fullName: string): CardPatron => ({
  fullName,
  external: false,
  libraryCardNumbers: [],
  matriculationNumber: null,
  dashedMatriculationNumber: null,
  blocks: {},
  postalAddresses: [],
});
const entity = (
  id: string,
  link = `/users/${encodeURIComponent(id)}`,
  type = EntityType.USER,
): Entity => ({ id, link, type, description: `User ${id}` });

describe('extractPatronId', () => {
  it('extracts an id from the canonical USER link when it matches Entity.id', () => {
    expect(extractPatronId(entity('user@example.org'))).toBe(
      'user@example.org',
    );
  });

  it('accepts the raw at-sign used in an otherwise strict USER path segment', () => {
    expect(
      extractPatronId(entity('user@example.org', '/users/user@example.org')),
    ).toBe('user@example.org');
  });

  it('accepts Alma percent-encoding of an otherwise unreserved dot', () => {
    expect(
      extractPatronId(
        entity('user@example.org', '/users/user%40example%2Eorg'),
      ),
    ).toBe('user@example.org');
  });

  [
    entity('other', '/users/user'),
    entity('user', '/users/user/'),
    entity('user', '/users/group/user'),
    entity('user', 'https://alma.example/users/user'),
    entity('user', '/users/user?expand=full'),
    entity('user', '/users/user#fragment'),
    entity('a/b', '/users/a%2Fb'),
    entity('%2F', '/users/%252F'),
    entity('user', '/users/%E0%A4%A'),
    entity('', '/users/'),
    entity(' user ', '/users/%20user%20'),
    entity('user', '/users/user', EntityType.ITEM),
  ].forEach((value, index) => {
    it(`rejects noncanonical entity/link shape ${index + 1} without disclosing it`, () => {
      expect(extractPatronId(value)).toBeNull();
    });
  });
});

describe('PatronStateService', () => {
  let entities$: BehaviorSubject<Entity[]>;
  let api: jasmine.SpyObj<PatronApiService>;
  let authorization: jasmine.SpyObj<AuthorizationService>;
  const configure = (autoSelect = 'false'): PatronStateService => {
    entities$ = new BehaviorSubject<Entity[]>([]);
    api = jasmine.createSpyObj<PatronApiService>('PatronApiService', [
      'getPatron',
    ]);
    authorization = jasmine.createSpyObj<AuthorizationService>(
      'AuthorizationService',
      ['check'],
    );
    authorization.check.and.returnValue(of({ status: 'allowed' }));

    TestBed.configureTestingModule({
      providers: [
        PatronStateService,
        { provide: PatronApiService, useValue: api },
        { provide: AuthorizationService, useValue: authorization },
        {
          provide: CloudAppEventsService,
          useValue: { entities$ },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { isAutoSelect: autoSelect } } },
        },
      ],
    });

    return TestBed.inject(PatronStateService);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('filters SDK entities to USER metadata', () => {
    const service = configure();
    const user = entity('one');
    const item = entity('item', '/items/item', EntityType.ITEM);
    let observed: readonly Entity[] = [];

    service.userEntities$.subscribe((entities) => {
      observed = entities;
    });
    entities$.next([item, user]);

    expect(observed).toEqual([user]);
  });

  it('cancels an obsolete patron load when selection changes', () => {
    const service = configure();
    const first$ = new Subject<CardPatron>();
    const firstEntity = entity('first');
    const secondEntity = entity('second');
    const firstPatron = patron('First');
    const secondPatron = patron('Second');
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValues(first$, of(secondPatron));
    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(firstEntity);
    service.select(secondEntity);
    first$.next(firstPatron);

    expect(observed as PatronState).toEqual({
      status: 'ready',
      entity: secondEntity,
      patron: secondPatron,
    });
  });

  it('shares one backend load across multiple active subscribers', () => {
    const service = configure();
    const selected = entity('one');
    const response$ = new Subject<CardPatron>();

    api.getPatron.and.returnValue(response$);

    const first = service.patronState$.subscribe();
    const second = service.patronState$.subscribe();

    service.select(selected);

    expect(api.getPatron).toHaveBeenCalledOnceWith('one');
    response$.next(patron('One'));
    expect(api.getPatron).toHaveBeenCalledTimes(1);
    first.unsubscribe();
    second.unsubscribe();
  });

  it('clears an invalid selection without calling the backend', () => {
    const service = configure();
    let observed: PatronState = { status: 'loading', entity: entity('old') };

    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(entity('secret-id', '/users/different'));

    expect(observed as PatronState).toEqual({ status: 'empty' });
    expect(api.getPatron).not.toHaveBeenCalled();
  });

  it('auto-selects only an authorized exact single USER when route says true', () => {
    const service = configure('true');
    const selected = entity('one');

    api.getPatron.and.returnValue(of(patron('One')));
    service.patronState$.subscribe();
    service.autoSelect('true');
    entities$.next([selected]);

    expect(api.getPatron).toHaveBeenCalledOnceWith('one');
  });

  [
    { flag: 'false', entities: [entity('one')] },
    { flag: 'TRUE', entities: [entity('one')] },
    { flag: 'true', entities: [entity('one'), entity('two')] },
  ].forEach(({ flag, entities }, index) => {
    it(`does not auto-select outside the exact approved condition ${index + 1}`, () => {
      const service = configure(flag);

      api.getPatron.and.returnValue(of(patron('One')));
      service.patronState$.subscribe();
      service.autoSelect(flag);
      entities$.next(entities);

      expect(api.getPatron).not.toHaveBeenCalled();
    });
  });

  it('does not auto-select when authorization is denied', () => {
    const service = configure('true');

    authorization.check.and.returnValue(
      of({ status: 'denied', reason: 'authorization' }),
    );
    api.getPatron.and.returnValue(of(patron('One')));
    service.patronState$.subscribe();
    service.autoSelect('true');
    entities$.next([entity('one')]);

    expect(api.getPatron).not.toHaveBeenCalled();
  });

  it('clears selection when the selected entity disappears', () => {
    const service = configure();
    const selected = entity('one');
    let observed: Entity | null = null;

    api.getPatron.and.returnValue(of(patron('One')));
    service.selectedEntity$.subscribe((value) => {
      observed = value;
    });
    entities$.next([selected]);
    service.select(selected);
    entities$.next([entity('two')]);

    expect(observed).toBeNull();
  });

  it('clears selection when the matching entity metadata changes', () => {
    const service = configure();
    const selected = entity('one');

    api.getPatron.and.returnValue(of(patron('One')));
    service.patronState$.subscribe();
    entities$.next([selected]);
    service.select(selected);
    entities$.next([{ ...selected, link: '/users/different' }]);

    expect(service.currentPatronId()).toBeNull();
  });

  it('maps a backend PATRON_NOT_FOUND response to not-found', () => {
    const service = configure();
    const selected = entity('missing');
    const error: CardApiError = {
      type: 'PATRON_NOT_FOUND',
      errorId: 'support-1',
      context: {},
    };
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404, error }),
      ) as Observable<CardPatron>,
    );
    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(selected);

    expect(observed as PatronState).toEqual({
      status: 'not-found',
      entity: selected,
    });
  });

  it('normalizes a temporary HttpErrorResponse without a Card error body', () => {
    const service = configure();
    const selected = entity('one');
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValue(
      throwError(
        () => new HttpErrorResponse({ status: 503, error: 'gateway down' }),
      ),
    );
    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(selected);

    expect(observed as PatronState).toEqual({
      status: 'error',
      entity: selected,
      error: { type: 'DEPENDENCY_UNAVAILABLE', errorId: '', context: {} },
    });
  });

  it('normalizes an unknown non-HTTP failure safely', () => {
    const service = configure();
    const selected = entity('one');
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValue(throwError(() => new Error('private')));
    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(selected);

    expect(observed as PatronState).toEqual({
      status: 'error',
      entity: selected,
      error: { type: 'UNEXPECTED_FAILURE', errorId: '', context: {} },
    });
  });

  it('replaces a ready patron only for the entity that initiated the mutation', () => {
    const service = configure();
    const first = entity('first');
    const second = entity('second');
    const firstPatron = patron('First');
    const secondPatron = patron('Second');
    const staleMutation = patron('Stale mutation');
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValues(of(firstPatron), of(secondPatron));
    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(first);
    service.select(second);
    service.replacePatron(staleMutation, 'first');

    expect(observed as PatronState).toEqual({
      status: 'ready',
      entity: second,
      patron: secondPatron,
    });
  });

  it('replaces the current patron after a successful mutation without refetching', () => {
    const service = configure();
    const selected = entity('one');
    const original = patron('Original');
    const updated = patron('Updated');
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValue(of(original));
    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(selected);
    service.replacePatron(updated, 'one');

    expect(observed as PatronState).toEqual({
      status: 'ready',
      entity: selected,
      patron: updated,
    });
    expect(api.getPatron).toHaveBeenCalledTimes(1);
  });
});
