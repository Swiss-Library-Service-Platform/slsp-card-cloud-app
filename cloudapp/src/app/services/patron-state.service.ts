import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CloudAppEventsService,
  Entity,
  EntityType,
} from '@exlibris/exl-cloudapp-angular-lib';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  combineLatest,
  concat,
  defer,
  distinctUntilChanged,
  filter,
  map,
  merge,
  of,
  shareReplay,
  switchMap,
  take,
} from 'rxjs';

import {
  CardApiError,
  CardErrorType,
  CardPatron,
} from '../models/card-api.model';
import {
  AuthorizationResult,
  AuthorizationService,
} from './authorization.service';
import { PatronApiService } from './patron-api.service';

export type PatronState =
  | { readonly status: 'empty' }
  | { readonly status: 'loading'; readonly entity: Entity }
  | {
      readonly status: 'ready';
      readonly entity: Entity;
      readonly patron: CardPatron;
    }
  | { readonly status: 'not-found'; readonly entity: Entity }
  | {
      readonly status: 'error';
      readonly entity: Entity;
      readonly error: CardApiError;
    };

interface PatronReplacement {
  readonly patron: CardPatron;
  readonly patronId: string;
}

const CARD_ERROR_TYPES: readonly CardErrorType[] = [
  'AUTHENTICATION_FAILED',
  'ACCESS_DENIED',
  'INVALID_PATRON_ID',
  'PATRON_NOT_FOUND',
  'INVALID_LIBRARY_CARD_FORMAT',
  'DUPLICATE_LIBRARY_CARD_NUMBER',
  'UNSUPPORTED_BLOCK',
  'BLOCK_COMMENT_REQUIRED',
  'STALE_SELECTION',
  'INVALID_SETTINGS_NOTE',
  'UPSTREAM_FAILURE',
  'DEPENDENCY_UNAVAILABLE',
  'UNEXPECTED_FAILURE',
];

export function extractPatronId(entity: Entity): string | null {
  if (entity.type !== EntityType.USER) {
    return null;
  }

  const match = /^\/users\/([^/?#]+)$/.exec(entity.link);

  if (!match) {
    return null;
  }

  try {
    const encodedId = match[1];
    const decodedId = decodeURIComponent(encodedId);

    if (
      decodedId === '' ||
      decodedId !== decodedId.trim() ||
      decodedId !== entity.id ||
      /[\\/\u0000-\u001f\u007f]/u.test(decodedId) ||
      /%[0-9a-f]{2}/iu.test(decodedId)
    ) {
      return null;
    }

    return decodedId;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class PatronStateService {
  public readonly authorization$: Observable<AuthorizationResult>;
  public readonly patronState$: Observable<PatronState>;
  public readonly selectedEntity$: Observable<Entity | null>;
  public readonly selectedPatronId$: Observable<string | null>;
  public readonly userEntities$: Observable<readonly Entity[]>;

  private readonly api = inject(PatronApiService);
  private readonly authorization = inject(AuthorizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly events = inject(CloudAppEventsService);
  private readonly replacements$ = new Subject<PatronReplacement>();
  private readonly selection$ = new BehaviorSubject<Entity | null>(null);

  public constructor() {
    this.authorization$ = defer(() => this.authorization.check()).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.userEntities$ = this.events.entities$.pipe(
      map((entities) =>
        entities.filter((entity) => entity.type === EntityType.USER),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.selectedEntity$ = this.selection$.pipe(
      distinctUntilChanged(sameEntity),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.selectedPatronId$ = this.selectedEntity$.pipe(
      map((entity) => (entity ? extractPatronId(entity) : null)),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.patronState$ = this.selection$.pipe(
      distinctUntilChanged(sameEntity),
      switchMap((entity) => {
        const patronId = entity ? extractPatronId(entity) : null;

        return entity && patronId
          ? this.load(entity, patronId)
          : of<PatronState>({ status: 'empty' });
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.events.entities$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entities) => this.clearMissingSelection(entities));
  }

  public select(entity: Entity): void {
    if (!extractPatronId(entity)) {
      this.clear();

      return;
    }

    this.selection$.next(entity);
  }

  public autoSelect(routeFlag: string | undefined): void {
    if (routeFlag !== 'true') {
      return;
    }

    combineLatest([this.authorization$, this.userEntities$])
      .pipe(
        filter(
          ([authorization, entities]) =>
            authorization.status === 'allowed' && entities.length === 1,
        ),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([, entities]) => this.select(entities[0]));
  }

  public replacePatron(patron: CardPatron, expectedPatronId: string): void {
    if (this.currentPatronId() === expectedPatronId) {
      this.replacements$.next({ patron, patronId: expectedPatronId });
    }
  }

  public clear(): void {
    this.selection$.next(null);
  }

  public currentPatronId(): string | null {
    const entity = this.selection$.value;

    return entity ? extractPatronId(entity) : null;
  }

  private clearMissingSelection(entities: readonly Entity[]): void {
    const selected = this.selection$.value;

    if (selected && !entities.some((entity) => sameEntity(entity, selected))) {
      this.clear();
    }
  }

  private load(entity: Entity, patronId: string): Observable<PatronState> {
    const initial$ = this.api.getPatron(patronId).pipe(
      map((patron): PatronState => ({ status: 'ready', entity, patron })),
      catchError((error: unknown) => of(this.errorState(entity, error))),
    );
    const replacement$ = this.replacements$.pipe(
      filter((replacement) => replacement.patronId === patronId),
      map(({ patron }): PatronState => ({ status: 'ready', entity, patron })),
    );

    return concat(
      of<PatronState>({ status: 'loading', entity }),
      merge(initial$, replacement$),
    );
  }

  private errorState(entity: Entity, error: unknown): PatronState {
    const apiError = normalizeCardError(error);

    return apiError.type === 'PATRON_NOT_FOUND'
      ? { status: 'not-found', entity }
      : { status: 'error', entity, error: apiError };
  }
}

function sameEntity(left: Entity | null, right: Entity | null): boolean {
  return (
    left === right ||
    (!!left &&
      !!right &&
      left.type === right.type &&
      left.id === right.id &&
      left.link === right.link)
  );
}

function normalizeCardError(error: unknown): CardApiError {
  if (error instanceof HttpErrorResponse) {
    if (isCardApiError(error.error)) {
      return error.error;
    }

    if (error.status === 502) {
      return emptyError('UPSTREAM_FAILURE');
    }

    if (error.status === 0 || error.status === 503 || error.status === 504) {
      return emptyError('DEPENDENCY_UNAVAILABLE');
    }
  }

  return emptyError('UNEXPECTED_FAILURE');
}

function isCardApiError(value: unknown): value is CardApiError {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['type'] === 'string' &&
    CARD_ERROR_TYPES.includes(candidate['type'] as CardErrorType) &&
    typeof candidate['errorId'] === 'string' &&
    typeof candidate['context'] === 'object' &&
    candidate['context'] !== null &&
    !Array.isArray(candidate['context'])
  );
}

function emptyError(type: CardErrorType): CardApiError {
  return { type, errorId: '', context: {} };
}
