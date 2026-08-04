import { DestroyRef, Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService, Entity } from '@exlibris/exl-cloudapp-angular-lib';
import {
  Observable,
  asapScheduler,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  observeOn,
  shareReplay,
} from 'rxjs';

import { AuthorizationResult } from '../services/authorization.service';
import { BackendHttpService } from '../services/backend-http.service';
import { CardErrorService } from '../services/card-error.service';
import {
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';

interface MainViewModel {
  readonly authorization: AuthorizationResult;
  readonly authorizationMessage: string | null;
  readonly entities: readonly Entity[];
  readonly patron: PatronState;
  readonly sandbox: boolean;
}

interface EntitySelectionChange {
  readonly value: unknown;
}

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent implements OnInit {
  public readonly vm$: Observable<MainViewModel>;

  private readonly alert = inject(AlertService);
  private readonly backend = inject(BackendHttpService);
  private readonly cardErrors = inject(CardErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(PatronStateService);

  public constructor() {
    this.vm$ = combineLatest([
      this.state.authorization$,
      this.state.userEntities$,
      this.state.patronState$,
      this.backend.isSandbox$(),
    ]).pipe(
      map(([authorization, entities, patron, sandbox]) => {
        const presentation =
          patron.status === 'error'
            ? this.cardErrors.presentation(
                patron.error,
                patron.entity.description,
              )
            : null;
        const effectiveAuthorization: AuthorizationResult =
          patron.status === 'error' && presentation?.kind === 'access'
            ? {
                status: 'denied',
                reason: presentation.reason,
                error: patron.error,
              }
            : authorization;

        return {
          authorization: effectiveAuthorization,
          authorizationMessage:
            effectiveAuthorization.status === 'allowed'
              ? null
              : this.cardErrors.message(effectiveAuthorization.error),
          entities,
          patron,
          sandbox,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  public ngOnInit(): void {
    this.state
      .autoSelect$(this.route.snapshot.params['isAutoSelect'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
    this.state.patronState$
      .pipe(
        filter(
          (patronState) =>
            patronState.status === 'ready' ||
            patronState.status === 'not-found' ||
            patronState.status === 'error',
        ),
        distinctUntilChanged(),
        observeOn(asapScheduler),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((patronState) => this.handlePatronState(patronState));
  }

  public entitySelected(event: EntitySelectionChange): void {
    if (isEntity(event.value)) {
      this.state.select(event.value);
    }
  }

  public trackEntity(_index: number, entity: Entity): string {
    return `${entity.type}:${entity.id}:${entity.link}`;
  }

  private handlePatronState(patronState: PatronState): void {
    if (patronState.status === 'ready') {
      void this.router.navigate(['usermenu']);

      return;
    }

    if (patronState.status === 'not-found') {
      const notFoundPresentation = this.cardErrors.presentation(
        patronState.error,
        patronState.entity.description,
      );

      this.alert.warn(notFoundPresentation.message, { autoClose: false });
      this.state.clear();

      return;
    }

    if (patronState.status !== 'error') {
      return;
    }

    const presentation = this.cardErrors.presentation(
      patronState.error,
      patronState.entity.description,
    );

    if (presentation.kind === 'warning') {
      this.alert.warn(presentation.message, { autoClose: false });
      this.state.clear();

      return;
    }

    this.alert.error(presentation.message, { autoClose: false });

    if (presentation.kind !== 'access') {
      this.state.clear();
    }
  }
}

function isEntity(value: unknown): value is Entity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['link'] === 'string' &&
    typeof candidate['type'] === 'string' &&
    typeof candidate['description'] === 'string'
  );
}
