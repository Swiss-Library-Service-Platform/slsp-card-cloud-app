import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { Observable, finalize, tap } from 'rxjs';

import {
  CardPatron,
  InvoiceEmailAddressView,
  SetInvoiceEmailAddressRequest,
} from '../models/card-api.model';
import { MutationFeedbackService } from '../services/mutation-feedback.service';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronStateService,
} from '../services/patron-state.service';
import {
  invoiceEmailValidator,
  normalizeInvoiceEmail,
} from './invoice-contact-rules';

type InvoiceSource = 'preferred' | 'custom';

@Component({
  selector: 'app-invoice-email-address',
  templateUrl: './invoice-email-address.component.html',
  styleUrls: ['./invoice-email-address.component.scss'],
})
export class InvoiceEmailAddressComponent implements OnChanges {
  @Input({ required: true }) public patron!: CardPatron;
  @Input() public disabled = false;
  @Output() public readonly busyChange = new EventEmitter<boolean>();

  public readonly form = new FormGroup({
    source: new FormControl<InvoiceSource>('preferred', { nonNullable: true }),
    emailAddress: new FormControl('', {
      nonNullable: true,
      validators: invoiceEmailValidator,
    }),
  });
  public loading = false;

  private confirmed = false;
  private confirmedEmail: InvoiceEmailAddressView | null = null;
  private confirmedInvoiceKey = '';
  private confirmedPatronId: string | null = null;
  private confirmedPreferred: string | null = null;
  private readonly api = inject(PatronApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly feedback = inject(MutationFeedbackService);
  private readonly state = inject(PatronStateService);

  public constructor() {
    this.form.controls.source.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyControlState());
  }

  public get preferredEmailAddress(): string | null {
    return this.confirmedPreferred;
  }

  public get preferredMissing(): boolean {
    return !this.confirmedPreferred;
  }

  public ngOnChanges(): void {
    this.acceptConfirmedPatron(
      this.patron,
      this.state.currentMutationContext()?.patronId ?? null,
    );
    this.applyControlState();
  }

  public cancel(): void {
    this.resetForm();
  }

  public save(): void {
    if (this.disabled || this.loading) {
      return;
    }

    const mutationContext = this.state.currentMutationContext();

    if (!mutationContext) {
      return;
    }

    if (this.form.controls.source.value === 'preferred') {
      if (!this.confirmedEmail || !this.confirmedPreferred) {
        return;
      }
      this.mutate(
        this.api.removeInvoiceEmailAddress(
          mutationContext.patronId,
          this.confirmedEmail.elementReference,
        ),
        mutationContext,
        'Settings.InvoiceEmailRemoveSuccess',
      );

      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const request: SetInvoiceEmailAddressRequest = {
      elementReference: this.confirmedEmail?.elementReference ?? null,
      emailAddress: normalizeInvoiceEmail(
        this.form.controls.emailAddress.getRawValue(),
      ),
    };

    if (request.emailAddress === this.confirmedEmail?.emailAddress) {
      return;
    }

    this.mutate(
      this.api.setInvoiceEmailAddress(mutationContext.patronId, request),
      mutationContext,
      'Settings.InvoiceEmailSetSuccess',
    );
  }

  private mutate(
    operation: Observable<CardPatron>,
    mutationContext: PatronMutationContext,
    successKey: string,
  ): void {
    this.setBusy(true);
    operation
      .pipe(
        tap((patron) => {
          this.acceptConfirmedPatron(patron, mutationContext.patronId);
          this.state.replacePatron(patron, mutationContext);
        }),
        this.feedback.handle(successKey),
        finalize(() => this.setBusy(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private acceptConfirmedPatron(
    patron: CardPatron,
    patronId: string | null,
  ): void {
    const invoiceKey = JSON.stringify(patron.invoiceEmailAddress);
    const resetRequired =
      !this.confirmed ||
      patronId !== this.confirmedPatronId ||
      invoiceKey !== this.confirmedInvoiceKey;

    this.confirmed = true;
    this.confirmedPatronId = patronId;
    this.confirmedPreferred = patron.preferredEmailAddress;

    if (!resetRequired) {
      return;
    }

    this.confirmedInvoiceKey = invoiceKey;
    this.confirmedEmail = patron.invoiceEmailAddress;
    this.resetForm();
  }

  private resetForm(): void {
    const source: InvoiceSource = this.confirmedEmail
      ? 'custom'
      : this.confirmedPreferred
        ? 'preferred'
        : 'custom';

    this.form.reset(
      {
        source,
        emailAddress: this.confirmedEmail?.emailAddress ?? '',
      },
      { emitEvent: false },
    );
    this.applyControlState();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private setCustomControlEnabled(enabled: boolean): void {
    if (enabled) {
      this.form.controls.emailAddress.enable({ emitEvent: false });
    } else {
      this.form.controls.emailAddress.disable({ emitEvent: false });
    }
  }

  private applyControlState(): void {
    if (this.disabled || this.loading) {
      this.form.disable({ emitEvent: false });

      return;
    }

    this.form.controls.source.enable({ emitEvent: false });
    this.setCustomControlEnabled(
      this.form.controls.source.getRawValue() === 'custom',
    );
  }

  private setBusy(value: boolean): void {
    this.loading = value;
    this.applyControlState();
    this.busyChange.emit(value);
  }
}
