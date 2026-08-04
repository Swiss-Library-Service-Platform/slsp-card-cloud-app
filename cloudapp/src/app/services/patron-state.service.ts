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
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  map,
  merge,
  of,
  share,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap,
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

declare const patronMutationContextBrand: unique symbol;

export interface PatronMutationContext {
  readonly patronId: string;
  readonly [patronMutationContextBrand]: true;
}

interface PatronSelection {
  readonly entity: Entity;
  readonly mutationContext: PatronMutationContext;
}

interface PatronReplacement {
  readonly patron: CardPatron;
  readonly mutationContext: PatronMutationContext;
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
      decodedId === '.' ||
      decodedId === '..' ||
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
  private readonly selection$ = new BehaviorSubject<PatronSelection | null>(
    null,
  );

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
      map((selection) => selection?.entity ?? null),
      distinctUntilChanged(sameEntity),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.selectedPatronId$ = this.selection$.pipe(
      map((selection) => selection?.mutationContext.patronId ?? null),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.patronState$ = this.selection$.pipe(
      switchMap((selection) =>
        selection ? this.load(selection) : of<PatronState>({ status: 'empty' }),
      ),
      // This root singleton intentionally owns one bounded replay so route
      // teardown cannot discard the selected Card DTO or restart its GET.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.events.entities$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entities) => this.clearMissingSelection(entities));
  }

  public select(entity: Entity): void {
    const patronId = extractPatronId(entity);

    if (!patronId) {
      this.clear();

      return;
    }

    const mutationContext = {
      patronId,
    } as PatronMutationContext;

    this.selection$.next({ entity, mutationContext });
  }

  public autoSelect$(routeFlag: string | undefined): Observable<void> {
    if (routeFlag !== 'true') {
      return EMPTY;
    }

    return combineLatest([this.authorization$, this.userEntities$]).pipe(
      filter(([, entities]) => entities.length > 0),
      take(1),
      takeUntil(
        this.selection$.pipe(filter((selection) => selection !== null)),
      ),
      tap(([authorization, entities]) => {
        if (
          authorization.status === 'allowed' &&
          entities.length === 1 &&
          this.currentPatronId() === null
        ) {
          this.select(entities[0]);
        }
      }),
      map(() => undefined),
    );
  }

  public replacePatron(
    patron: CardPatron,
    mutationContext: PatronMutationContext,
  ): void {
    if (this.selection$.value?.mutationContext === mutationContext) {
      this.replacements$.next({ patron, mutationContext });
    }
  }

  public clear(): void {
    this.selection$.next(null);
  }

  public currentPatronId(): string | null {
    return this.selection$.value?.mutationContext.patronId ?? null;
  }

  public currentMutationContext(): PatronMutationContext | null {
    return this.selection$.value?.mutationContext ?? null;
  }

  private clearMissingSelection(entities: readonly Entity[]): void {
    const selected = this.selection$.value;

    if (
      selected &&
      !entities.some((entity) => sameEntity(entity, selected.entity))
    ) {
      this.clear();
    }
  }

  private load(selection: PatronSelection): Observable<PatronState> {
    const { entity, mutationContext } = selection;
    const replacement$ = this.replacements$.pipe(
      filter((replacement) => replacement.mutationContext === mutationContext),
      map(({ patron }): PatronState => ({ status: 'ready', entity, patron })),
      share(),
    );
    const initial$ = this.api.getPatron(mutationContext.patronId).pipe(
      map((patron): PatronState => ({ status: 'ready', entity, patron })),
      catchError((error: unknown) => of(this.errorState(entity, error))),
      takeUntil(replacement$),
    );

    return merge(
      of<PatronState>({ status: 'loading', entity }),
      initial$,
      replacement$,
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
      left.link === right.link &&
      left.description === right.description)
  );
}

function normalizeCardError(error: unknown): CardApiError {
  if (error instanceof HttpErrorResponse) {
    if (isCardApiError(error.error, error.status)) {
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

function isCardApiError(value: unknown, status: number): value is CardApiError {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['type'] === 'string' &&
    CARD_ERROR_TYPES.includes(candidate['type'] as CardErrorType) &&
    typeof candidate['errorId'] === 'string' &&
    candidate['errorId'].trim() !== '' &&
    typeof candidate['context'] === 'object' &&
    candidate['context'] !== null &&
    !Array.isArray(candidate['context']) &&
    hasOnlyStringValues(candidate['context']) &&
    errorStatus(candidate['type'] as CardErrorType) === status
  );
}

function hasOnlyStringValues(value: object): boolean {
  const record = value as Record<string, unknown>;

  for (const key in record) {
    if (typeof record[key] !== 'string') {
      return false;
    }
  }

  return true;
}

function errorStatus(type: CardErrorType): number {
  switch (type) {
    case 'AUTHENTICATION_FAILED':
      return 401;
    case 'ACCESS_DENIED':
      return 403;
    case 'INVALID_PATRON_ID':
    case 'INVALID_LIBRARY_CARD_FORMAT':
    case 'UNSUPPORTED_BLOCK':
    case 'BLOCK_COMMENT_REQUIRED':
      return 400;
    case 'PATRON_NOT_FOUND':
      return 404;
    case 'DUPLICATE_LIBRARY_CARD_NUMBER':
    case 'STALE_SELECTION':
    case 'INVALID_SETTINGS_NOTE':
      return 409;
    case 'UPSTREAM_FAILURE':
      return 502;
    case 'DEPENDENCY_UNAVAILABLE':
      return 503;
    case 'UNEXPECTED_FAILURE':
      return 500;
  }
}

function emptyError(type: CardErrorType): CardApiError {
  return { type, errorId: '', context: {} };
}
