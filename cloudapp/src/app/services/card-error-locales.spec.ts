import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import de from '../../i18n/de.json';
import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import italian from '../../i18n/it.json';
import { CardErrorType } from '../models/card-api.model';
import {
  CardErrorPresentation,
  CardErrorService,
  normalizeCardError,
} from './card-error.service';

// Exhaustive client contract, checked against ErrorType.java during integration.
const statuses: Record<CardErrorType, number> = {
  AUTHENTICATION_FAILED: 401,
  ACCESS_DENIED: 403,
  INVALID_PATRON_ID: 400,
  INVALID_USER_GROUP: 400,
  USER_GROUP_NOT_ELIGIBLE: 409,
  EDU_ID_SYNC_NOT_SUPPORTED: 400,
  SYNC_OUTCOME_UNKNOWN: 503,
  SYNC_REFRESH_FAILED: 502,
  SYNC_PATRON_UNAVAILABLE: 404,
  PATRON_NOT_FOUND: 404,
  INVALID_LIBRARY_CARD_NUMBER: 400,
  DUPLICATE_LIBRARY_CARD_NUMBER: 409,
  UNSUPPORTED_BLOCK: 400,
  BLOCK_COMMENT_REQUIRED: 400,
  INVALID_INVOICE_POSTAL_ADDRESS: 400,
  INVALID_INVOICE_EMAIL_ADDRESS: 400,
  STALE_ELEMENT_REFERENCE: 409,
  INVALID_SETTINGS_NOTE: 409,
  ALMA_REQUEST_REJECTED: 502,
  ALMA_FAILURE: 502,
  REGISTRATION_PLATFORM_FAILURE: 502,
  REGISTRATION_PLATFORM_UNAVAILABLE: 503,
  ALMA_UNAVAILABLE: 503,
  UNEXPECTED_FAILURE: 500,
  UPSTREAM_FAILURE: 502,
  DEPENDENCY_UNAVAILABLE: 503,
};

for (const [language, translations] of Object.entries({
  de,
  en,
  fr,
  it: italian,
})) {
  describe(`Card errors in ${language}`, () => {
    let service: CardErrorService;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });

      const translate = TestBed.inject(TranslateService);

      translate.setTranslation(language, translations);
      translate.use(language);
      service = TestBed.inject(CardErrorService);
    });

    it('uses translated task-specific recovery guidance', () => {
      const failure = {
        type: 'REGISTRATION_PLATFORM_UNAVAILABLE' as const,
        errorId: '0123456789abcdef',
        messages: [],
      };
      const card = service.message(failure, undefined, 'card-check');
      const groups = service.message(failure, undefined, 'group-load');

      expect(card).toContain(translations.Errors.CardCheckFailed);
      expect(groups).toContain(translations.Errors.GroupsLoadFailed);

      for (const message of [card, groups]) {
        expect(message).not.toMatch(/Errors\.|\{\{/u);
        expect(message).toContain('0123456789abcdef');
      }
      expect(
        service.message(
          { ...failure, type: 'ACCESS_DENIED' },
          undefined,
          'group-load',
        ),
      ).toContain(translations.Errors.AccessDenied);
      expect(
        service.message(
          { ...failure, type: 'DUPLICATE_LIBRARY_CARD_NUMBER' },
          undefined,
          'card-check',
        ),
      ).toBe(translations.Errors.DuplicateLibraryCardNumber);
      // A lost HTTP response does not prove that a write was never applied.
      expect(
        service.message(
          { ...failure, type: 'DEPENDENCY_UNAVAILABLE' },
          undefined,
          'card-check',
        ),
      ).toBe(translations.Errors.DependencyUnavailable);
    });

    it('renders every backend HTTP error using shipped translations', () => {
      for (const [type, status] of Object.entries(statuses)) {
        if (type === 'UPSTREAM_FAILURE' || type === 'DEPENDENCY_UNAVAILABLE') {
          continue;
        }

        const response = new HttpErrorResponse({
          status,
          error: { type, errorId: '0123456789abcdef', messages: [] },
        });

        expect(normalizeCardError(response).type).withContext(type).toBe(type);

        const message = service.message(response, '<Test & patron>');

        expect(message)
          .withContext(type)
          .not.toMatch(/Errors\.|\{\{/u);
        expect(message).withContext(type).not.toContain('<Test & patron>');

        if (type === 'PATRON_NOT_FOUND') {
          expect(message).toContain('&lt;Test &amp; patron&gt;');
        }
      }
    });

    it('keeps invalid numbers, duplicates and dependency failures distinct', () => {
      const present = (type: CardErrorType): CardErrorPresentation =>
        service.presentation(
          new HttpErrorResponse({
            status: statuses[type],
            error: { type, errorId: '0123456789abcdef', messages: [] },
          }),
        );
      const invalid = present('INVALID_LIBRARY_CARD_NUMBER');
      const duplicate = present('DUPLICATE_LIBRARY_CARD_NUMBER');
      const unavailable = present('REGISTRATION_PLATFORM_UNAVAILABLE');
      const failure = present('REGISTRATION_PLATFORM_FAILURE');

      expect(invalid.kind).toBe('warning');
      expect(duplicate.kind).toBe('warning');
      expect(unavailable.kind).toBe('error');
      expect(failure.kind).toBe('error');
      expect(
        new Set([
          invalid.message,
          duplicate.message,
          unavailable.message,
          failure.message,
        ]).size,
      ).toBe(4);
      expect(invalid.message).not.toContain('0123456789abcdef');
      expect(duplicate.message).not.toContain('0123456789abcdef');
      expect(unavailable.message).toContain('0123456789abcdef');
      expect(failure.message).toContain('0123456789abcdef');
    });

    it('localizes untyped network failures without inventing support IDs', () => {
      for (const status of [0, 502, 503, 504]) {
        const message = service.message(new HttpErrorResponse({ status }));

        expect(message).not.toMatch(/Errors\.|\{\{|slsp-support-reference/u);
      }
    });
  });
}
