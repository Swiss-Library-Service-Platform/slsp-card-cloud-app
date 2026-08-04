import { DestroyRef, Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService, Entity } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import {
  Observable,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
} from 'rxjs';

import { AuthorizationResult } from '../services/authorization.service';
import { BackendHttpService } from '../services/backend-http.service';
import {
  PatronState,
  PatronStateService,
} from '../services/patron-state.service';

interface MainViewModel {
  readonly authorization: AuthorizationResult;
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(PatronStateService);
  private readonly translate = inject(TranslateService);

  public constructor() {
    this.vm$ = combineLatest([
      this.state.authorization$,
      this.state.userEntities$,
      this.state.patronState$,
      this.backend.isSandbox$(),
    ]).pipe(
      map(([authorization, entities, patron, sandbox]) => ({
        authorization,
        entities,
        patron,
        sandbox,
      })),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  public ngOnInit(): void {
    this.state.autoSelect(this.route.snapshot.params['isAutoSelect']);
    this.state.patronState$
      .pipe(
        filter(
          (patronState) =>
            patronState.status === 'ready' ||
            patronState.status === 'not-found' ||
            patronState.status === 'error',
        ),
        distinctUntilChanged(),
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
      this.alert.warn(
        `${patronState.entity.description}${this.translate.instant('Main.UserNotFound')}`,
        { autoClose: false },
      );

      return;
    }

    this.alert.error(this.translate.instant('Main.TemporarilyUnavailable'), {
      autoClose: false,
    });
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
