import { DestroyRef, Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, combineLatest, filter, map, shareReplay } from 'rxjs';

import { CardPatron } from '../models/card-api.model';
import { BackendHttpService } from '../services/backend-http.service';
import { PatronStateService } from '../services/patron-state.service';

interface UsermenuViewModel {
  readonly patron: CardPatron;
  readonly hasBlocks: boolean;
  readonly sandbox: boolean;
}

@Component({
  selector: 'app-usermenu',
  templateUrl: './usermenu.component.html',
  styleUrls: ['./usermenu.component.scss'],
})
export class UsermenuComponent implements OnInit {
  public readonly vm$: Observable<UsermenuViewModel | null>;

  private readonly backend = inject(BackendHttpService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly state = inject(PatronStateService);

  public constructor() {
    this.vm$ = combineLatest([
      this.state.patronState$,
      this.backend.isSandbox$(),
    ]).pipe(
      map(([patronState, sandbox]) =>
        patronState.status === 'ready'
          ? {
              patron: patronState.patron,
              hasBlocks: hasDisplayedBlocks(patronState.patron),
              sandbox,
            }
          : null,
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  public ngOnInit(): void {
    this.state.patronState$
      .pipe(
        filter(
          (patronState) =>
            patronState.status === 'empty' ||
            patronState.status === 'not-found' ||
            patronState.status === 'error',
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        void this.router.navigate(['root/false']);
      });
  }

  public navigateBack(): void {
    this.state.clear();
    void this.router.navigate(['root/false']);
  }
}

function hasDisplayedBlocks(patron: CardPatron): boolean {
  return !!(
    patron.blocks['02'] ||
    patron.blocks['03'] ||
    patron.blocks['03.1'] ||
    patron.blocks['09'] ||
    patron.blocks['08']
  );
}
