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
  'STALE_ELEMENT_REFERENCE',
  'INVALID_SETTINGS_NOTE',
  'INVALID_INVOICE_POSTAL_ADDRESS',
  'INVALID_INVOICE_EMAIL_ADDRESS',
  'ALMA_REQUEST_REJECTED',
  'ALMA_FAILURE',
  'ALMA_UNAVAILABLE',
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
        StaleElementReference: 'The element reference is stale.',
        InvalidSettingsNote: 'The shared settings are invalid.',
        InvalidInvoicePostalAddress: 'The invoice postal address is invalid.',
        InvalidInvoiceEmailAddress: 'The invoice e-mail address is invalid.',
        AlmaRequestRejected:
          'Alma could not process the request. Reload the patron and try again. If the problem persists, contact support.',
        AlmaFailure:
          'Alma returned an unexpected response. Reload the patron and try again. If the problem persists, contact support.',
        AlmaUnavailable:
          'Alma is temporarily unavailable. Reload the patron before trying again. If the problem persists, contact support.',
        RegistrationPlatformFailure:
          'The Registration Platform could not process the request.',
        RegistrationPlatformUnavailable:
          'The Registration Platform is temporarily unavailable.',
        UpstreamFailure: 'A required service returned an unexpected response.',
        DependencyUnavailable: 'A required service is temporarily unavailable.',
        UnexpectedFailure: 'An unexpected error occurred.',
        SelectedPatron: 'The selected patron',
        SupportId: 'Support ID: {{errorId}}',
      },
    });
    translate.use('en');
    service = TestBed.inject(CardErrorService);
  });

  it('maps every backend error type and ignores backend context', () => {
    for (const type of ALL_CARD_ERROR_TYPES) {
      const message = service.message({
        type,
        errorId: 'support-123',
        context: {
          detail: 'private backend detail',
          entityDescription: 'backend-selected patron',
        },
      });

      expect(message).withContext(type).not.toContain(type);
      expect(message).withContext(type).not.toContain('private backend detail');
      expect(message)
        .withContext(type)
        .not.toContain('backend-selected patron');
    }
  });

  it('shows support ids only for access, not-found, and system failures', () => {
    const withSupportId: readonly CardErrorType[] = [
      'AUTHENTICATION_FAILED',
      'ACCESS_DENIED',
      'PATRON_NOT_FOUND',
      'ALMA_REQUEST_REJECTED',
      'ALMA_FAILURE',
      'ALMA_UNAVAILABLE',
      'UNEXPECTED_FAILURE',
    ];
    const withoutSupportId = ALL_CARD_ERROR_TYPES.filter(
      (type) => !withSupportId.includes(type),
    );

    for (const type of withSupportId) {
      expect(service.message(cardError(type)))
        .withContext(type)
        .toContain('Support ID: support-123');
    }

    for (const type of withoutSupportId) {
      expect(service.message(cardError(type)))
        .withContext(type)
        .not.toContain('support-123');
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
      'STALE_ELEMENT_REFERENCE',
      'INVALID_SETTINGS_NOTE',
      'INVALID_INVOICE_POSTAL_ADDRESS',
      'INVALID_INVOICE_EMAIL_ADDRESS',
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

  it('distinguishes rejected, invalid, and unavailable Alma responses', () => {
    expect(service.presentation(cardError('ALMA_REQUEST_REJECTED'))).toEqual({
      kind: 'error',
      message:
        'Alma could not process the request. Reload the patron and try again. If the problem persists, contact support. Support ID: support-123',
    });
    expect(service.presentation(cardError('ALMA_FAILURE'))).toEqual({
      kind: 'error',
      message:
        'Alma returned an unexpected response. Reload the patron and try again. If the problem persists, contact support. Support ID: support-123',
    });
    expect(service.presentation(cardError('ALMA_UNAVAILABLE'))).toEqual({
      kind: 'error',
      message:
        'Alma is temporarily unavailable. Reload the patron before trying again. If the problem persists, contact support. Support ID: support-123',
    });
  });

  it('names Registration Platform failures and preserves their support IDs', () => {
    for (const [type, status, message] of [
      [
        'REGISTRATION_PLATFORM_FAILURE',
        502,
        'The Registration Platform could not process the request.',
      ],
      [
        'REGISTRATION_PLATFORM_UNAVAILABLE',
        503,
        'The Registration Platform is temporarily unavailable.',
      ],
    ] as const) {
      expect(
        service.message(
          new HttpErrorResponse({ status, error: cardError(type) }),
        ),
      ).toBe(`${message} Support ID: support-123`);
      expect(
        service.message(
          new HttpErrorResponse({ status: 500, error: cardError(type) }),
        ),
      ).toBe('An unexpected error occurred.');
    }
  });

  it('does not infer a service from untyped gateway or connection failures', () => {
    for (const status of [0, 502, 503, 504]) {
      const message = service.message(new HttpErrorResponse({ status }));

      expect(message).not.toContain('Alma');
      expect(message).not.toContain('Registration Platform');
      expect(message).not.toContain('Support ID');
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
      error: cardError('STALE_ELEMENT_REFERENCE'),
    });
    const mismatched = new HttpErrorResponse({
      status: 500,
      error: {
        ...cardError('STALE_ELEMENT_REFERENCE'),
        context: { detail: 'private backend detail' },
      },
    });

    expect(service.presentation(valid)).toEqual({
      kind: 'warning',
      message: 'The element reference is stale.',
    });
    expect(service.presentation(mismatched)).toEqual({
      kind: 'error',
      message: 'An unexpected error occurred.',
    });
  });

  it('accepts invoice validation errors only with HTTP 400', () => {
    for (const type of [
      'INVALID_INVOICE_POSTAL_ADDRESS',
      'INVALID_INVOICE_EMAIL_ADDRESS',
    ] as const) {
      expect(
        service.presentation(
          new HttpErrorResponse({ status: 400, error: cardError(type) }),
        ).kind,
      )
        .withContext(type)
        .toBe('warning');
    }
  });

  it('accepts an upstream rejection only with HTTP 502', () => {
    const error = cardError('ALMA_REQUEST_REJECTED');

    expect(
      service.presentation(new HttpErrorResponse({ status: 502, error })),
    ).toEqual({
      kind: 'error',
      message:
        'Alma could not process the request. Reload the patron and try again. If the problem persists, contact support. Support ID: support-123',
    });
    expect(
      service.presentation(new HttpErrorResponse({ status: 400, error })),
    ).toEqual({
      kind: 'error',
      message: 'An unexpected error occurred.',
    });
  });

  it('maps untyped transport responses to temporary-unavailable copy without fabricating a support id', () => {
    const response = new HttpErrorResponse({ status: 504 });

    expect(service.presentation(response)).toEqual({
      kind: 'error',
      message: 'A required service is temporarily unavailable.',
    });
  });

  it('omits correlation ids containing characters outside the support-id allowlist', () => {
    const message = service.message({
      ...cardError('ALMA_FAILURE'),
      errorId: 'support-123<script>',
    });

    expect(message).toBe(
      'Alma returned an unexpected response. Reload the patron and try again. If the problem persists, contact support.',
    );
  });
});

function cardError(type: CardErrorType): CardApiError {
  return { type, errorId: 'support-123', context: {} };
}
