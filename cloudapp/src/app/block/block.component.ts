import { Location } from '@angular/common';
import { DestroyRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, catchError, finalize, map, tap } from 'rxjs';

import {
  AddableBlockCode,
  BlockView,
  CardPatron,
} from '../models/card-api.model';
import { PatronApiService } from '../services/patron-api.service';
import { PatronStateService } from '../services/patron-state.service';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['block.component.scss'],
})
export class BlockComponent {
  public readonly patron$: Observable<CardPatron | null>;
  public collapseGlobal = true;
  public collapsedDouble = true;
  public collapsedNew = true;
  public collapsedWrongEmail = true;
  public collapsedWrongPostal = true;
  public commentDouble = '';
  public commentGlobal = '';
  public commentWrongEmail = '';
  public commentWrongPostal = '';
  public loading = false;

  private readonly alert = inject(AlertService);
  private readonly api = inject(PatronApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly location = inject(Location);
  private readonly state = inject(PatronStateService);
  private readonly translate = inject(TranslateService);

  public constructor() {
    this.patron$ = this.state.patronState$.pipe(
      map((patronState) =>
        patronState.status === 'ready' ? patronState.patron : null,
      ),
    );
  }

  public add(code: AddableBlockCode, comment: string): void {
    const trimmedComment = comment.trim();
    const mutationContext = this.state.currentMutationContext();

    if (
      this.loading ||
      !mutationContext ||
      (code === '09' && trimmedComment === '')
    ) {
      return;
    }

    this.loading = true;
    this.api
      .addBlock(mutationContext.patronId, code, trimmedComment)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
          this.alert.success(this.translate.instant('Blocks.AddSuccess'), {
            autoClose: false,
          });
        }),
        catchError((_error: unknown) => {
          this.alert.error(this.translate.instant('Blocks.AddError'), {
            autoClose: false,
          });

          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public getDateString(date: string | null): string {
    return date ? new Date(date).toUTCString() : '';
  }

  public hasBlocks(blocks: CardPatron['blocks']): boolean {
    return !!(
      blocks['02'] ||
      blocks['03'] ||
      blocks['03.1'] ||
      blocks['09'] ||
      blocks['08']
    );
  }

  public navigateBack(): void {
    this.location.back();
  }

  public remove(block: BlockView): void {
    const mutationContext = this.state.currentMutationContext();

    if (this.loading || !mutationContext) {
      return;
    }

    this.loading = true;
    this.api
      .removeBlock(mutationContext.patronId, block.selector)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
          this.alert.success(this.translate.instant('Blocks.RemoveSuccess'), {
            autoClose: false,
          });
        }),
        catchError((_error: unknown) => {
          this.alert.error(this.translate.instant('Blocks.RemoveError'), {
            autoClose: false,
          });

          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
