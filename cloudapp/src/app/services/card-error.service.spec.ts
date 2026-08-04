import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { CardApiError, CardErrorType } from '../models/card-api.model';
import { CardErrorService } from './card-error.service';

const ALL_CARD_ERROR_TYPES = [
  'AUTHENTICATION_FAILED',
  'ACCESS_DENIED',
  'INVALID_PATRON_ID',
  'PATRON_NOT_FOUND',
  'INVALID_LIBRARY_CARD_FORMAT',
  'DUPLICATE_LIBRARY_CARD_NUMBER',
  'UNSUPPORTED_BLOCK',
  'BLOCK_COMMENT_REQUIRED',
  'STALE_SELECTION',
  'INVALID_SETTINGS_NOTE',
  'UPSTREAM_FAILURE',
  'DEPENDENCY_UNAVAILABLE',
  'UNEXPECTED_FAILURE',
] as const satisfies readonly CardErrorType[];

describe('CardErrorService', () => {
  let service: CardErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      Errors: {
        AuthenticationFailed: 'Authentication failed.',
        AccessDenied: 'Access denied.',
        InvalidPatronId: 'The selected patron cannot be loaded.',
        PatronNotFound:
          '{{entityDescription}} was not found in the Network Zone.',
        InvalidLibraryCardFormat: 'The card number format is invalid.',
        DuplicateLibraryCardNumber: 'The card number is already in use.',
        UnsupportedBlock: 'The block is unsupported.',
        BlockCommentRequired: 'A block comment is required.',
        StaleSelection: 'The selection is stale.',
        InvalidSettingsNote: 'The shared settings are invalid.',
        UpstreamFailure: 'Service temporarily unavailable.',
        DependencyUnavailable: 'Service temporarily unavailable.',
        UnexpectedFailure: 'An unexpected error occurred.',
        SelectedPatron: 'The selected patron',
        SupportId: 'Support ID: {{errorId}}',
      },
    });
    translate.use('en');
    service = TestBed.inject(CardErrorService);
  });

  it('maps every backend error type, appends the support id, and ignores backend context', () => {
    for (const type of ALL_CARD_ERROR_TYPES) {
      const message = service.message({
        type,
        errorId: 'support-123',
        context: {
          detail: 'private backend detail',
          entityDescription: 'backend-selected patron',
        },
      });

      expect(message).withContext(type).toContain('support-123');
      expect(message).withContext(type).not.toContain(type);
      expect(message).withContext(type).not.toContain('private backend detail');
      expect(message)
        .withContext(type)
        .not.toContain('backend-selected patron');
    }
  });

  it('maps authentication and authorization failures to access states', () => {
    expect(service.presentation(cardError('AUTHENTICATION_FAILED'))).toEqual({
      kind: 'access',
      reason: 'authentication',
      message: 'Authentication failed. Support ID: support-123',
    });
    expect(service.presentation(cardError('ACCESS_DENIED'))).toEqual({
      kind: 'access',
      reason: 'authorization',
      message: 'Access denied. Support ID: support-123',
    });
  });

  it('uses warning presentations for patron and business validation conflicts', () => {
    const warningTypes: readonly CardErrorType[] = [
      'INVALID_PATRON_ID',
      'PATRON_NOT_FOUND',
      'INVALID_LIBRARY_CARD_FORMAT',
      'DUPLICATE_LIBRARY_CARD_NUMBER',
      'UNSUPPORTED_BLOCK',
      'BLOCK_COMMENT_REQUIRED',
      'STALE_SELECTION',
      'INVALID_SETTINGS_NOTE',
    ];

    for (const type of warningTypes) {
      expect(service.presentation(cardError(type)).kind)
        .withContext(type)
        .toBe('warning');
    }
  });

  it('preserves the separately supplied selected entity description for patron-not-found', () => {
    const message = service.message(
      {
        ...cardError('PATRON_NOT_FOUND'),
        context: { entityDescription: 'backend-selected patron' },
      },
      'Selected patron',
    );

    expect(message).toBe(
      'Selected patron was not found in the Network Zone. Support ID: support-123',
    );
  });

  it('encodes markup in the selected entity description for the alert inner-html boundary', () => {
    const message = service.message(
      cardError('PATRON_NOT_FOUND'),
      '<strong>Selected & "patron"</strong>',
    );

    expect(message).toBe(
      '&lt;strong&gt;Selected &amp; &quot;patron&quot;&lt;/strong&gt; was not found in the Network Zone. Support ID: support-123',
    );
  });

  it('uses temporary-unavailable error copy for transport failures', () => {
    for (const type of [
      'UPSTREAM_FAILURE',
      'DEPENDENCY_UNAVAILABLE',
    ] as const) {
      expect(service.presentation(cardError(type))).toEqual({
        kind: 'error',
        message: 'Service temporarily unavailable. Support ID: support-123',
      });
    }
  });

  it('uses a generic error without unsafe fields for unknown or malformed responses', () => {
    const malformed = {
      type: 'NEW_BACKEND_ERROR',
      errorId: '<script>alert(1)</script>',
      context: { detail: 'private backend detail' },
    };

    expect(service.presentation(malformed)).toEqual({
      kind: 'error',
      message: 'An unexpected error occurred.',
    });
    expect(service.message(null)).toBe('An unexpected error occurred.');
  });

  it('accepts a typed HTTP error only when its type matches the exact status', () => {
    const valid = new HttpErrorResponse({
      status: 409,
      error: cardError('STALE_SELECTION'),
    });
    const mismatched = new HttpErrorResponse({
      status: 500,
      error: {
        ...cardError('STALE_SELECTION'),
        context: { detail: 'private backend detail' },
      },
    });

    expect(service.presentation(valid)).toEqual({
      kind: 'warning',
      message: 'The selection is stale. Support ID: support-123',
    });
    expect(service.presentation(mismatched)).toEqual({
      kind: 'error',
      message: 'An unexpected error occurred.',
    });
  });

  it('maps untyped transport responses to temporary-unavailable copy without fabricating a support id', () => {
    const response = new HttpErrorResponse({ status: 504 });

    expect(service.presentation(response)).toEqual({
      kind: 'error',
      message: 'Service temporarily unavailable.',
    });
  });

  it('omits correlation ids containing characters outside the support-id allowlist', () => {
    const message = service.message({
      ...cardError('STALE_SELECTION'),
      errorId: 'support-123<script>',
    });

    expect(message).toBe('The selection is stale.');
  });
});

function cardError(type: CardErrorType): CardApiError {
  return { type, errorId: 'support-123', context: {} };
}
