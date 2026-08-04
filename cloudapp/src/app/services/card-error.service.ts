import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { CardApiError, CardErrorType } from '../models/card-api.model';

export type CardErrorPresentation =
  | {
      readonly kind: 'access';
      readonly reason: 'authentication' | 'authorization';
      readonly message: string;
    }
  | { readonly kind: 'warning'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

const ERROR_KEYS: Record<CardErrorType, string> = {
  AUTHENTICATION_FAILED: 'Errors.AuthenticationFailed',
  ACCESS_DENIED: 'Errors.AccessDenied',
  INVALID_PATRON_ID: 'Errors.InvalidPatronId',
  PATRON_NOT_FOUND: 'Errors.PatronNotFound',
  INVALID_LIBRARY_CARD_FORMAT: 'Errors.InvalidLibraryCardFormat',
  DUPLICATE_LIBRARY_CARD_NUMBER: 'Errors.DuplicateLibraryCardNumber',
  UNSUPPORTED_BLOCK: 'Errors.UnsupportedBlock',
  BLOCK_COMMENT_REQUIRED: 'Errors.BlockCommentRequired',
  STALE_SELECTION: 'Errors.StaleSelection',
  INVALID_SETTINGS_NOTE: 'Errors.InvalidSettingsNote',
  UPSTREAM_FAILURE: 'Errors.UpstreamFailure',
  DEPENDENCY_UNAVAILABLE: 'Errors.DependencyUnavailable',
  UNEXPECTED_FAILURE: 'Errors.UnexpectedFailure',
};
const ERROR_KINDS: Record<CardErrorType, 'access' | 'warning' | 'error'> = {
  AUTHENTICATION_FAILED: 'access',
  ACCESS_DENIED: 'access',
  INVALID_PATRON_ID: 'warning',
  PATRON_NOT_FOUND: 'warning',
  INVALID_LIBRARY_CARD_FORMAT: 'warning',
  DUPLICATE_LIBRARY_CARD_NUMBER: 'warning',
  UNSUPPORTED_BLOCK: 'warning',
  BLOCK_COMMENT_REQUIRED: 'warning',
  STALE_SELECTION: 'warning',
  INVALID_SETTINGS_NOTE: 'warning',
  UPSTREAM_FAILURE: 'error',
  DEPENDENCY_UNAVAILABLE: 'error',
  UNEXPECTED_FAILURE: 'error',
};
const SAFE_SUPPORT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

@Injectable({ providedIn: 'root' })
export class CardErrorService {
  private readonly translate = inject(TranslateService);

  public message(error: unknown, entityDescription?: string): string {
    return this.presentation(error, entityDescription).message;
  }

  public presentation(
    error: unknown,
    entityDescription?: string,
  ): CardErrorPresentation {
    const apiError = isCardApiError(error) ? error : normalizeCardError(error);
    const message = this.localizedMessage(apiError, entityDescription);
    const kind = ERROR_KINDS[apiError.type];

    if (kind === 'access') {
      return {
        kind,
        reason:
          apiError.type === 'AUTHENTICATION_FAILED'
            ? 'authentication'
            : 'authorization',
        message,
      };
    }

    return { kind, message };
  }

  private localizedMessage(
    error: CardApiError,
    entityDescription: string | undefined,
  ): string {
    const description = safeEntityDescription(entityDescription);
    const message = this.translate.instant(ERROR_KEYS[error.type], {
      entityDescription:
        description || this.translate.instant('Errors.SelectedPatron'),
    });
    const errorId = safeSupportId(error.errorId);

    if (!errorId) {
      return message;
    }

    return `${message} ${this.translate.instant('Errors.SupportId', {
      errorId,
    })}`;
  }
}

export function normalizeCardError(error: unknown): CardApiError {
  if (error instanceof HttpErrorResponse) {
    if (isHttpCardApiError(error.error, error.status)) {
      return error.error;
    }

    if (error.status === 502) {
      return emptyError('UPSTREAM_FAILURE');
    }

    if (error.status === 0 || error.status === 503 || error.status === 504) {
      return emptyError('DEPENDENCY_UNAVAILABLE');
    }
  }

  return emptyError('UNEXPECTED_FAILURE');
}

function isCardApiError(value: unknown): value is CardApiError {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['type'] === 'string' &&
    Object.prototype.hasOwnProperty.call(ERROR_KEYS, candidate['type']) &&
    typeof candidate['errorId'] === 'string' &&
    isStringRecord(candidate['context'])
  );
}

function isHttpCardApiError(
  value: unknown,
  status: number,
): value is CardApiError {
  return (
    isCardApiError(value) &&
    value.errorId.trim() !== '' &&
    SAFE_SUPPORT_ID.test(value.errorId.trim()) &&
    errorStatus(value.type) === status
  );
}

function isStringRecord(
  value: unknown,
): value is Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === 'string');
}

function safeSupportId(errorId: string): string | null {
  const value = errorId.trim();

  return SAFE_SUPPORT_ID.test(value) ? value : null;
}

function safeEntityDescription(description: string | undefined): string {
  return (description ?? '')
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim()
    .slice(0, 200)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function errorStatus(type: CardErrorType): number {
  switch (type) {
    case 'AUTHENTICATION_FAILED':
      return 401;
    case 'ACCESS_DENIED':
      return 403;
    case 'INVALID_PATRON_ID':
    case 'INVALID_LIBRARY_CARD_FORMAT':
    case 'UNSUPPORTED_BLOCK':
    case 'BLOCK_COMMENT_REQUIRED':
      return 400;
    case 'PATRON_NOT_FOUND':
      return 404;
    case 'DUPLICATE_LIBRARY_CARD_NUMBER':
    case 'STALE_SELECTION':
    case 'INVALID_SETTINGS_NOTE':
      return 409;
    case 'UPSTREAM_FAILURE':
      return 502;
    case 'DEPENDENCY_UNAVAILABLE':
      return 503;
    case 'UNEXPECTED_FAILURE':
      return 500;
  }
}

function emptyError(type: CardErrorType): CardApiError {
  return { type, errorId: '', context: {} };
}
