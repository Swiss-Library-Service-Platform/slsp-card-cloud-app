import { DestroyRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, filter, finalize, map, switchMap, tap } from 'rxjs';

import {
  ConfirmationDialogData,
  ConfirmationdialogComponent,
} from '../confirmationdialog/confirmationdialog.component';
import { CardPatron, LibraryCardNumberView } from '../models/card-api.model';
import { MutationFeedbackService } from '../services/mutation-feedback.service';
import { PatronApiService } from '../services/patron-api.service';
import { PatronStateService } from '../services/patron-state.service';

interface LibraryCardNumberForm {
  readonly newLibraryCardNumber: FormControl<string | null>;
}

@Component({
  selector: 'app-librarycardnumber',
  templateUrl: './librarycardnumber.component.html',
  styleUrls: ['./librarycardnumber.component.scss'],
})
export class LibraryCardNumberComponent {
  public readonly numberForm: FormGroup<LibraryCardNumberForm>;
  public readonly patron$: Observable<CardPatron | null>;
  public loading = false;

  private readonly api = inject(PatronApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly feedback = inject(MutationFeedbackService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly state = inject(PatronStateService);
  private readonly translate = inject(TranslateService);

  public constructor() {
    this.numberForm = this.formBuilder.group<LibraryCardNumberForm>({
      newLibraryCardNumber: new FormControl<string | null>('', {
        validators: [nonBlankValidator],
      }),
    });
    this.patron$ = this.state.patronState$.pipe(
      map((patronState) =>
        patronState.status === 'ready' ? patronState.patron : null,
      ),
    );
  }

  public add(formDirective: FormGroupDirective): void {
    const value = this.numberForm.controls.newLibraryCardNumber.value?.trim();
    const mutationContext = this.state.currentMutationContext();

    if (this.loading || this.numberForm.invalid || !value || !mutationContext) {
      return;
    }

    this.loading = true;
    this.api
      .addLibraryCardNumber(mutationContext.patronId, value)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
          formDirective.resetForm();
          this.numberForm.reset();
        }),
        this.feedback.handle('LibraryCardNumber.AddSuccess'),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public remove(item: LibraryCardNumberView): void {
    if (this.loading || !item.removable || !item.elementReference) {
      return;
    }

    const mutationContext = this.state.currentMutationContext();
    const data: ConfirmationDialogData = {
      confirmMessage: this.translate.instant('LibraryCardNumber.Sure'),
    };

    this.dialog
      .open(ConfirmationdialogComponent, { disableClose: false, data })
      .afterClosed()
      .pipe(
        filter((confirmed): confirmed is true => confirmed === true),
        switchMap(() => {
          if (
            this.loading ||
            !mutationContext ||
            this.state.currentMutationContext() !== mutationContext ||
            !item.elementReference
          ) {
            return EMPTY;
          }

          this.loading = true;

          return this.api
            .removeLibraryCardNumber(
              mutationContext.patronId,
              item.elementReference,
            )
            .pipe(
              tap((patron) => {
                this.state.replacePatron(patron, mutationContext);
              }),
              this.feedback.handle('LibraryCardNumber.RemoveSuccess'),
              finalize(() => {
                this.loading = false;
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public trackLibraryCardNumber(
    index: number,
    item: LibraryCardNumberView,
  ): string {
    return item.elementReference ?? `${index}:${item.value ?? ''}`;
  }
}

const nonBlankValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim() !== ''
    ? null
    : { required: true };
