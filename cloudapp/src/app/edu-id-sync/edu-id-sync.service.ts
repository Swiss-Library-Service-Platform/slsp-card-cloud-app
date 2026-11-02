import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, finalize, tap } from 'rxjs';

import {
  PERSISTENT_ALERT_OPTIONS,
  SUCCESS_ALERT_OPTIONS,
} from '../alert-options';
import {
  CardErrorService,
  normalizeCardError,
} from '../services/card-error.service';
import { MutationActivityService } from '../services/mutation-activity.service';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronStateService,
} from '../services/patron-state.service';

// Own confirmed requests and recovery state beyond the initiating view's lifetime.
@Injectable({ providedIn: 'root' })
export class EduIdSyncService {
  public loading = false;
  private readonly activity = inject(MutationActivityService);
  private readonly api = inject(PatronApiService);
  private readonly state = inject(PatronStateService);
  private readonly errors = inject(CardErrorService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private refreshPatronId: string | null = null;

  public get supported(): boolean {
    return /^[0-9]+@(test\.)?eduid\.ch$/i.test(
      this.state.currentMutationContext()?.patronId ?? '',
    );
  }

  public get needsRefresh(): boolean {
    return (
      !!this.refreshPatronId &&
      this.refreshPatronId === this.state.currentMutationContext()?.patronId
    );
  }

  public sync(context: PatronMutationContext): void {
    if (
      !this.supported ||
      this.loading ||
      this.activity.busy ||
      this.needsRefresh ||
      this.state.currentMutationContext() !== context
    ) {
      return;
    }
    this.loading = true;

    this.api
      .syncEduId(context.patronId)
      .pipe(
        tap((patron) => {
          if (this.state.currentMutationContext() !== context) {
            return;
          }
          this.state.replacePatron(patron, context);
          this.activity.eligibilityRefresh$.next();
          this.alert.success(
            this.translate.instant('EduIdSync.Success'),
            SUCCESS_ALERT_OPTIONS,
          );
        }),
        catchError((error: unknown) => {
          const apiError =
            error instanceof HttpErrorResponse &&
            (error.status === 0 || error.status === 504)
              ? {
                  type: 'SYNC_OUTCOME_UNKNOWN' as const,
                  errorId: '',
                  messages: [],
                }
              : normalizeCardError(error);
          const type = apiError.type;

          if (
            type === 'SYNC_OUTCOME_UNKNOWN' ||
            type === 'SYNC_REFRESH_FAILED'
          ) {
            this.refreshPatronId = context.patronId;
          }

          if (
            this.state.currentMutationContext()?.patronId === context.patronId
          ) {
            this.alert.error(
              this.errors.message(apiError),
              PERSISTENT_ALERT_OPTIONS,
            );

            if (type === 'SYNC_PATRON_UNAVAILABLE') {
              this.state.clear();
            }
          }

          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public refresh(): void {
    const context = this.state.currentMutationContext();

    if (!context || !this.needsRefresh || this.loading || this.activity.busy) {
      return;
    }
    this.loading = true;
    this.activity
      .run(() => this.api.getPatron(context.patronId))
      .pipe(
        tap((patron) => {
          if (this.state.currentMutationContext() !== context) {
            return;
          }
          this.refreshPatronId = null;
          this.alert.clear();
          this.state.replacePatron(patron, context);
          this.activity.eligibilityRefresh$.next();
        }),
        catchError((error: unknown) => {
          if (this.state.currentMutationContext() === context) {
            this.alert.error(
              this.errors.message(error),
              PERSISTENT_ALERT_OPTIONS,
            );

            if (normalizeCardError(error).type === 'PATRON_NOT_FOUND') {
              this.state.clear();
            }
          }

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
