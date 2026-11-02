import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { SetInvoicePostalAddressRequest } from '../models/card-api.model';
import { isSupportedInvoiceCountry } from './invoice-countries';

const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/u;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u;
const ASCII = /^[\x00-\x7f]+$/u;

export function normalizeInvoicePostalAddress(
  request: SetInvoicePostalAddressRequest,
): SetInvoicePostalAddressRequest {
  return {
    elementReference: request.elementReference,
    line1: request.line1.trim(),
    line2: optional(request.line2),
    line3: optional(request.line3),
    line4: optional(request.line4),
    postalCode: request.postalCode.trim(),
    city: request.city.trim(),
    countryCode: request.countryCode.trim().toUpperCase(),
  };
}

export function normalizeInvoiceEmail(value: string): string {
  return value.trim();
}

export function invoiceCountryValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  return isSupportedInvoiceCountry(control.value.trim().toUpperCase())
    ? null
    : { invoiceCountry: true };
}

export function invoiceRequiredValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

export function invoiceMaxLengthValidator(maxLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';

    return value.length <= maxLength
      ? null
      : {
          maxlength: { requiredLength: maxLength, actualLength: value.length },
        };
  };
}

export function invoiceEmailValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const value = normalizeInvoiceEmail(control.value);
  const separator = value.indexOf('@');

  if (
    value.length === 0 ||
    value.length > 64 ||
    !ASCII.test(value) ||
    separator <= 0 ||
    separator !== value.lastIndexOf('@') ||
    separator === value.length - 1
  ) {
    return { invoiceEmail: true };
  }

  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  const labels = domain.split('.');

  if (
    !EMAIL_LOCAL.test(local) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    labels.length < 2 ||
    labels.some((label) => label.length > 63 || !DOMAIN_LABEL.test(label))
  ) {
    return { invoiceEmail: true };
  }

  return null;
}

function optional(value: string | null): string | null {
  const normalized = value?.trim() ?? '';

  return normalized || null;
}
