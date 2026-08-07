import { DestroyRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, catchError, finalize, map, tap } from 'rxjs';

import {
  PERSISTENT_ALERT_OPTIONS,
  SUCCESS_ALERT_OPTIONS,
} from '../alert-options';
import {
  AddableBlockCode,
  BlockView,
  CardPatron,
} from '../models/card-api.model';
import { CardErrorService } from '../services/card-error.service';
import { PatronApiService } from '../services/patron-api.service';
import { PatronStateService } from '../services/patron-state.service';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['block.component.scss'],
})
export class BlockComponent {
  public readonly patron$: Observable<CardPatron | null>;
  public commentDouble = '';
  public commentGlobal = '';
  public commentWrongEmail = '';
  public commentWrongPostal = '';
  public loading = false;

  private readonly alert = inject(AlertService);
  private readonly api = inject(PatronApiService);
  private readonly cardErrors = inject(CardErrorService);
  private readonly destroyRef = inject(DestroyRef);
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
          this.alert.success(
            this.translate.instant('Blocks.AddSuccess'),
            SUCCESS_ALERT_OPTIONS,
          );
        }),
        catchError((error: unknown) => {
          this.presentError(error);

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
    if (!date) {
      return '';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat(this.translate.currentLang || 'en', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    }).format(parsedDate);
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

  public remove(block: BlockView): void {
    const mutationContext = this.state.currentMutationContext();

    if (this.loading || !mutationContext) {
      return;
    }

    this.loading = true;
    this.api
      .removeBlock(mutationContext.patronId, block.elementReference)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
          this.alert.success(
            this.translate.instant('Blocks.RemoveSuccess'),
            SUCCESS_ALERT_OPTIONS,
          );
        }),
        catchError((error: unknown) => {
          this.presentError(error);

          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private presentError(error: unknown): void {
    const presentation = this.cardErrors.presentation(error);

    if (presentation.kind === 'warning') {
      this.alert.warn(presentation.message, PERSISTENT_ALERT_OPTIONS);

      return;
    }

    this.alert.error(presentation.message, PERSISTENT_ALERT_OPTIONS);
  }
}
