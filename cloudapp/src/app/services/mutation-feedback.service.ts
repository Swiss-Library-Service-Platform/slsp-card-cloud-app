import { inject, Injectable } from '@angular/core';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, catchError, tap } from 'rxjs';

import {
  PERSISTENT_ALERT_OPTIONS,
  SUCCESS_ALERT_OPTIONS,
} from '../alert-options';
import { CardErrorService } from './card-error.service';

@Injectable({ providedIn: 'root' })
export class MutationFeedbackService {
  private readonly alert = inject(AlertService);
  private readonly cardErrors = inject(CardErrorService);
  private readonly translate = inject(TranslateService);

  public handle(
    successTranslationKey: string,
  ): <T>(source: Observable<T>) => Observable<T> {
    return <T>(source: Observable<T>): Observable<T> =>
      source.pipe(
        tap(() => {
          this.alert.success(
            this.translate.instant(successTranslationKey),
            SUCCESS_ALERT_OPTIONS,
          );
        }),
        catchError((error: unknown) => {
          const presentation = this.cardErrors.presentation(error);

          if (presentation.kind === 'warning') {
            this.alert.warn(presentation.message, PERSISTENT_ALERT_OPTIONS);
          } else {
            this.alert.error(presentation.message, PERSISTENT_ALERT_OPTIONS);
          }

          return EMPTY;
        }),
      );
  }
}
