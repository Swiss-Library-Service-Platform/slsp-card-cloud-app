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
import { TranslateService } from '@ngx-translate/core';
import { Observable, finalize, tap } from 'rxjs';

import {
  CardPatron,
  InvoicePostalAddressView,
  PostalAddressView,
  SetInvoicePostalAddressRequest,
} from '../models/card-api.model';
import { MutationFeedbackService } from '../services/mutation-feedback.service';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronStateService,
} from '../services/patron-state.service';
import {
  buildInvoiceCountryOptions,
  InvoiceCountryOption,
} from './invoice-countries';
import {
  invoiceCountryValidator,
  invoiceMaxLengthValidator,
  invoiceRequiredValidator,
  normalizeInvoicePostalAddress,
} from './invoice-contact-rules';

type InvoiceSource = 'preferred' | 'custom';

@Component({
  selector: 'app-invoice-postal-address',
  templateUrl: './invoice-postal-address.component.html',
  styleUrls: ['./invoice-postal-address.component.scss'],
})
export class InvoicePostalAddressComponent implements OnChanges {
  @Input({ required: true }) public patron!: CardPatron;
  @Input() public disabled = false;
  @Output() public readonly busyChange = new EventEmitter<boolean>();

  public readonly form = new FormGroup({
    source: new FormControl<InvoiceSource>('preferred', { nonNullable: true }),
    line1: new FormControl('', {
      nonNullable: true,
      validators: [invoiceRequiredValidator, invoiceMaxLengthValidator(40)],
    }),
    line2: new FormControl('', {
      nonNullable: true,
      validators: invoiceMaxLengthValidator(40),
    }),
    line3: new FormControl('', {
      nonNullable: true,
      validators: invoiceMaxLengthValidator(40),
    }),
    line4: new FormControl('', {
      nonNullable: true,
      validators: invoiceMaxLengthValidator(40),
    }),
    postalCode: new FormControl('', {
      nonNullable: true,
      validators: [invoiceRequiredValidator, invoiceMaxLengthValidator(7)],
    }),
    city: new FormControl('', {
      nonNullable: true,
      validators: [invoiceRequiredValidator, invoiceMaxLengthValidator(32)],
    }),
    countryCode: new FormControl('', {
      nonNullable: true,
      validators: invoiceCountryValidator,
    }),
  });
  public countryOptions: readonly InvoiceCountryOption[] = [];
  public loading = false;

  private confirmed = false;
  private confirmedInvoice: InvoicePostalAddressView | null = null;
  private confirmedInvoiceKey = '';
  private confirmedPatronId: string | null = null;
  private confirmedPreferred: PostalAddressView | null = null;
  private readonly api = inject(PatronApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly feedback = inject(MutationFeedbackService);
  private readonly state = inject(PatronStateService);
  private readonly translate = inject(TranslateService);

  public constructor() {
    this.form.controls.source.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyControlState());
  }

  public get preferredMissing(): boolean {
    return !this.confirmedPreferred;
  }

  public get preferredPostalAddress(): PostalAddressView | null {
    return this.confirmedPreferred;
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
      if (!this.confirmedInvoice || !this.confirmedPreferred) {
        return;
      }
      this.mutate(
        this.api.removeInvoicePostalAddress(
          mutationContext.patronId,
          this.confirmedInvoice.elementReference,
        ),
        mutationContext,
        'Settings.InvoicePostalRemoveSuccess',
      );

      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const request = normalizeInvoicePostalAddress({
      elementReference: this.confirmedInvoice?.elementReference ?? null,
      line1: value.line1,
      line2: value.line2,
      line3: value.line3,
      line4: value.line4,
      postalCode: value.postalCode,
      city: value.city,
      countryCode: value.countryCode,
    });

    if (this.sameAsConfirmed(request)) {
      return;
    }

    this.mutate(
      this.api.setInvoicePostalAddress(mutationContext.patronId, request),
      mutationContext,
      'Settings.InvoicePostalSetSuccess',
    );
  }

  public trackCountry(_index: number, country: InvoiceCountryOption): string {
    return country.code;
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
    const preferred =
      patron.postalAddresses.find((address) => address.preferred) ?? null;
    const invoiceKey = JSON.stringify(patron.invoicePostalAddress);
    const resetRequired =
      !this.confirmed ||
      patronId !== this.confirmedPatronId ||
      invoiceKey !== this.confirmedInvoiceKey;

    this.confirmed = true;
    this.confirmedPatronId = patronId;
    this.confirmedPreferred = preferred;

    if (!resetRequired) {
      return;
    }

    this.confirmedInvoiceKey = invoiceKey;
    this.confirmedInvoice = patron.invoicePostalAddress;
    this.countryOptions = buildInvoiceCountryOptions(
      this.translate.currentLang || this.translate.defaultLang || 'en',
      this.normalizedConfirmedCountryCode(),
    );
    this.resetForm();
  }

  private resetForm(): void {
    const source: InvoiceSource = this.confirmedInvoice
      ? 'custom'
      : this.confirmedPreferred
        ? 'preferred'
        : 'custom';

    this.form.reset(
      {
        source,
        line1: this.confirmedInvoice?.line1 ?? '',
        line2: this.confirmedInvoice?.line2 ?? '',
        line3: this.confirmedInvoice?.line3 ?? '',
        line4: this.confirmedInvoice?.line4 ?? '',
        postalCode: this.confirmedInvoice?.postalCode ?? '',
        city: this.confirmedInvoice?.city ?? '',
        countryCode: this.normalizedConfirmedCountryCode(),
      },
      { emitEvent: false },
    );
    this.applyControlState();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private setCustomControlsEnabled(enabled: boolean): void {
    const controls = [
      this.form.controls.line1,
      this.form.controls.line2,
      this.form.controls.line3,
      this.form.controls.line4,
      this.form.controls.postalCode,
      this.form.controls.city,
      this.form.controls.countryCode,
    ];

    controls.forEach((control) =>
      enabled
        ? control.enable({ emitEvent: false })
        : control.disable({ emitEvent: false }),
    );
  }

  private applyControlState(): void {
    if (this.disabled || this.loading) {
      this.form.disable({ emitEvent: false });

      return;
    }

    this.form.controls.source.enable({ emitEvent: false });
    this.setCustomControlsEnabled(
      this.form.controls.source.getRawValue() === 'custom',
    );
  }

  private normalizedConfirmedCountryCode(): string {
    return (this.confirmedInvoice?.countryCode ?? '').trim().toUpperCase();
  }

  private sameAsConfirmed(request: SetInvoicePostalAddressRequest): boolean {
    if (!this.confirmedInvoice) {
      return false;
    }

    return (
      request.line1 === (this.confirmedInvoice.line1 ?? '') &&
      request.line2 === this.confirmedInvoice.line2 &&
      request.line3 === this.confirmedInvoice.line3 &&
      request.line4 === this.confirmedInvoice.line4 &&
      request.postalCode === (this.confirmedInvoice.postalCode ?? '') &&
      request.city === (this.confirmedInvoice.city ?? '') &&
      request.countryCode === this.normalizedConfirmedCountryCode()
    );
  }

  private setBusy(value: boolean): void {
    this.loading = value;
    this.applyControlState();
    this.busyChange.emit(value);
  }
}
