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

import { CardApiError, CardPatron } from '../models/card-api.model';
import {
  AuthorizationResult,
  AuthorizationService,
} from './authorization.service';
import { normalizeCardError } from './card-error.service';
import { PatronApiService } from './patron-api.service';

export type PatronState =
  | { readonly status: 'empty' }
  | { readonly status: 'loading'; readonly entity: Entity }
  | {
      readonly status: 'ready';
      readonly entity: Entity;
      readonly patron: CardPatron;
    }
  | {
      readonly status: 'not-found';
      readonly entity: Entity;
      readonly error: CardApiError;
    }
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
      ? { status: 'not-found', entity, error: apiError }
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
