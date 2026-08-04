import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import {
  CloudAppEventsService,
  Entity,
  EntityType,
} from '@exlibris/exl-cloudapp-angular-lib';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  of,
  throwError,
} from 'rxjs';

import { CardApiError, CardPatron } from '../models/card-api.model';
import { AuthorizationService } from './authorization.service';
import { PatronApiService } from './patron-api.service';
import {
  PatronMutationContext,
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
const mutationContext = (
  service: PatronStateService,
): PatronMutationContext => {
  const context = service.currentMutationContext();

  if (!context) {
    throw new Error('Expected a selected patron mutation context');
  }

  return context;
};

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
    entity('.', '/users/.'),
    entity('..', '/users/..'),
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

  it('retains the selected patron across a sequential route handoff without refetching', () => {
    const service = configure();
    const selected = entity('one');
    const loaded = patron('One');
    const firstStates: PatronState[] = [];
    const secondStates: PatronState[] = [];

    api.getPatron.and.returnValue(of(loaded));

    const main = service.patronState$.subscribe((state) =>
      firstStates.push(state),
    );

    service.select(selected);
    main.unsubscribe();
    service.patronState$.subscribe((state) => secondStates.push(state));

    expect(api.getPatron).toHaveBeenCalledOnceWith('one');
    expect(firstStates.at(-1)).toEqual({
      status: 'ready',
      entity: selected,
      patron: loaded,
    });
    expect(secondStates).toEqual([
      { status: 'ready', entity: selected, patron: loaded },
    ]);
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
    service.autoSelect$('true').subscribe();
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
      service.autoSelect$(flag).subscribe();
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
    service.autoSelect$('true').subscribe();
    entities$.next([entity('one')]);

    expect(api.getPatron).not.toHaveBeenCalled();
  });

  it('waits through an initial empty list and selects the first single nonempty list', () => {
    const service = configure('true');

    api.getPatron.and.returnValue(of(patron('One')));
    service.patronState$.subscribe();
    service.autoSelect$('true').subscribe();
    entities$.next([]);
    entities$.next([entity('one')]);

    expect(api.getPatron).toHaveBeenCalledOnceWith('one');
  });

  it('finishes after the first multiple-entity decision and never selects a later singleton', () => {
    const service = configure('true');
    let completed = false;

    api.getPatron.and.returnValue(of(patron('One')));
    service.patronState$.subscribe();
    service.autoSelect$('true').subscribe({
      complete: () => {
        completed = true;
      },
    });
    entities$.next([entity('one'), entity('two')]);
    entities$.next([entity('one')]);

    expect(completed).toBeTrue();
    expect(api.getPatron).not.toHaveBeenCalled();
  });

  it('does not override a manual selection made before the auto-select decision', () => {
    const service = configure('true');
    const manual = entity('manual');

    api.getPatron.and.returnValue(of(patron('Manual')));
    service.patronState$.subscribe();
    service.autoSelect$('true').subscribe();
    service.select(manual);
    entities$.next([entity('automatic')]);

    expect(service.currentPatronId()).toBeNull();
    expect(api.getPatron).toHaveBeenCalledOnceWith('manual');
  });

  it('completes denied and route-disabled auto-select attempts without retaining entity listeners', () => {
    const service = configure('true');
    let deniedComplete = false;
    let disabledComplete = false;

    authorization.check.and.returnValue(
      of({ status: 'denied', reason: 'authorization' }),
    );
    service.autoSelect$('true').subscribe({
      complete: () => {
        deniedComplete = true;
      },
    });
    service.autoSelect$('false').subscribe({
      complete: () => {
        disabledComplete = true;
      },
    });
    entities$.next([entity('one')]);
    entities$.next([entity('later')]);

    expect(deniedComplete).toBeTrue();
    expect(disabledComplete).toBeTrue();
    expect(api.getPatron).not.toHaveBeenCalled();
  });

  it('stops a destroyed auto-select attempt before later entities arrive', () => {
    const service = configure('true');
    const attempt: Subscription = service.autoSelect$('true').subscribe();

    api.getPatron.and.returnValue(of(patron('One')));
    service.patronState$.subscribe();
    attempt.unsubscribe();
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

  it('treats a changed description as fresh selected entity metadata', () => {
    const service = configure();
    const original = entity('one');
    const renamed = { ...original, description: 'Renamed user' };
    const observed: (Entity | null)[] = [];

    api.getPatron.and.returnValues(
      of(patron('Original')),
      of(patron('Renamed')),
    );
    service.selectedEntity$.subscribe((selected) => observed.push(selected));
    service.patronState$.subscribe();
    service.select(original);
    service.select(renamed);

    expect(observed).toEqual([null, original, renamed]);
    expect(api.getPatron).toHaveBeenCalledTimes(2);
  });

  it('clears selection when only the live entity description changes', () => {
    const service = configure();
    const selected = entity('one');

    api.getPatron.and.returnValue(of(patron('One')));
    service.patronState$.subscribe();
    entities$.next([selected]);
    service.select(selected);
    entities$.next([{ ...selected, description: 'Renamed user' }]);

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

  it('does not trust PATRON_NOT_FOUND when the HTTP status is not 404', () => {
    const service = configure();
    const selected = entity('missing');
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: {
              type: 'PATRON_NOT_FOUND',
              errorId: 'support-1',
              context: {},
            },
          }),
      ),
    );
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

  [
    {
      label: 'blank error id',
      body: { type: 'PATRON_NOT_FOUND', errorId: '  ', context: {} },
    },
    {
      label: 'non-string context value',
      body: {
        type: 'PATRON_NOT_FOUND',
        errorId: 'support-1',
        context: { unsafe: { nested: 'private' } },
      },
    },
    {
      label: 'array context',
      body: {
        type: 'PATRON_NOT_FOUND',
        errorId: 'support-1',
        context: ['private'],
      },
    },
  ].forEach(({ label, body }) => {
    it(`discards a malformed typed error with ${label}`, () => {
      const service = configure();
      const selected = entity('missing');
      let observed: PatronState = { status: 'empty' };

      api.getPatron.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 404, error: body })),
      );
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
  });

  [
    ['AUTHENTICATION_FAILED', 401],
    ['ACCESS_DENIED', 403],
    ['INVALID_PATRON_ID', 400],
    ['PATRON_NOT_FOUND', 404],
    ['INVALID_LIBRARY_CARD_FORMAT', 400],
    ['DUPLICATE_LIBRARY_CARD_NUMBER', 409],
    ['UNSUPPORTED_BLOCK', 400],
    ['BLOCK_COMMENT_REQUIRED', 400],
    ['STALE_SELECTION', 409],
    ['INVALID_SETTINGS_NOTE', 409],
    ['UPSTREAM_FAILURE', 502],
    ['DEPENDENCY_UNAVAILABLE', 503],
    ['UNEXPECTED_FAILURE', 500],
  ].forEach(([type, status]) => {
    it(`accepts ${type} only at its backend HTTP status`, () => {
      const service = configure();
      const selected = entity('one');
      let observed: PatronState = { status: 'empty' };
      const error: CardApiError = {
        type: type as CardApiError['type'],
        errorId: 'support-1',
        context: { operation: 'safe' },
      };

      api.getPatron.and.returnValue(
        throwError(
          () => new HttpErrorResponse({ status: status as number, error }),
        ),
      );
      service.patronState$.subscribe((state) => {
        observed = state;
      });
      service.select(selected);

      if (type === 'PATRON_NOT_FOUND') {
        expect(observed as PatronState).toEqual({
          status: 'not-found',
          entity: selected,
        });
      } else {
        expect(observed as PatronState).toEqual({
          status: 'error',
          entity: selected,
          error,
        });
      }
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

    const firstSelection = mutationContext(service);

    service.select(second);
    service.replacePatron(staleMutation, firstSelection);

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

    const selection = mutationContext(service);

    service.replacePatron(updated, selection);

    expect(observed as PatronState).toEqual({
      status: 'ready',
      entity: selected,
      patron: updated,
    });
    expect(api.getPatron).toHaveBeenCalledTimes(1);
  });

  it('keeps a current mutation replacement authoritative over a late initial GET', () => {
    const service = configure();
    const selected = entity('one');
    const initial$ = new Subject<CardPatron>();
    const updated = patron('Updated');
    const observed: PatronState[] = [];

    api.getPatron.and.returnValue(initial$);
    service.patronState$.subscribe((state) => observed.push(state));
    service.select(selected);

    const selection = mutationContext(service);

    service.replacePatron(updated, selection);
    initial$.next(patron('Late original'));

    expect(observed.at(-1)).toEqual({
      status: 'ready',
      entity: selected,
      patron: updated,
    });
  });

  it('does not let a stale-ID replacement cancel the current pending GET', () => {
    const service = configure();
    const old = entity('old');
    const selected = entity('current');
    const initial$ = new Subject<CardPatron>();
    const loaded = patron('Current');
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValues(of(patron('Old')), initial$);
    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(old);

    const oldSelection = mutationContext(service);

    service.select(selected);
    service.replacePatron(patron('Stale'), oldSelection);
    initial$.next(loaded);

    expect(observed as PatronState).toEqual({
      status: 'ready',
      entity: selected,
      patron: loaded,
    });
  });

  it('rejects a late mutation from an earlier A selection after A to B to A', () => {
    const service = configure();
    const firstA = entity('a');
    const b = entity('b');
    const secondA = { ...firstA };
    const currentA = patron('Current A');
    let observed: PatronState = { status: 'empty' };

    api.getPatron.and.returnValues(
      of(patron('First A')),
      of(patron('B')),
      of(currentA),
    );
    service.patronState$.subscribe((state) => {
      observed = state;
    });
    service.select(firstA);

    const firstASelection = mutationContext(service);

    service.select(b);
    service.select(secondA);
    service.replacePatron(patron('Late first A mutation'), firstASelection);

    expect(observed as PatronState).toEqual({
      status: 'ready',
      entity: secondA,
      patron: currentA,
    });
  });
});
