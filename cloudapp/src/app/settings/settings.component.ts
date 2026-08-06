import { Location } from '@angular/common';
import { DestroyRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, catchError, finalize, map, tap } from 'rxjs';

import { CardPatron, PostalAddressView } from '../models/card-api.model';
import { CardErrorService } from '../services/card-error.service';
import { PatronApiService } from '../services/patron-api.service';
import { PatronStateService } from '../services/patron-state.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent {
  public readonly patron$: Observable<CardPatron | null>;
  public loading = false;

  private readonly alert = inject(AlertService);
  private readonly api = inject(PatronApiService);
  private readonly cardErrors = inject(CardErrorService);
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

  public changePreferredAddress(address: PostalAddressView): void {
    const mutationContext = this.state.currentMutationContext();

    if (
      this.loading ||
      address.preferred ||
      !address.elementReference ||
      !mutationContext
    ) {
      return;
    }

    this.loading = true;
    this.api
      .setPreferredAddress(mutationContext.patronId, address.elementReference)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
          this.alert.success(this.translate.instant('Settings.SetSuccess'), {
            autoClose: false,
          });
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

  public navigateBack(): void {
    this.location.back();
  }

  public trackAddress(index: number, address: PostalAddressView): string {
    return address.elementReference ?? `${index}:${address.types.join(',')}`;
  }

  private presentError(error: unknown): void {
    const presentation = this.cardErrors.presentation(error);

    if (presentation.kind === 'warning') {
      this.alert.warn(presentation.message, { autoClose: false });

      return;
    }

    this.alert.error(presentation.message, { autoClose: false });
  }
}
