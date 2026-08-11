import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import {
  PERSISTENT_ALERT_OPTIONS,
  SUCCESS_ALERT_OPTIONS,
} from '../alert-options';
import { MutationFeedbackService } from './mutation-feedback.service';

describe('MutationFeedbackService', () => {
  let alert: jasmine.SpyObj<AlertService>;
  let service: MutationFeedbackService;

  beforeEach(() => {
    alert = jasmine.createSpyObj<AlertService>('AlertService', [
      'success',
      'warn',
      'error',
    ]);

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        MutationFeedbackService,
        { provide: AlertService, useValue: alert },
      ],
    });

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      Success: 'Saved',
      Errors: {
        InvalidInvoicePostalAddress: 'Invalid invoice address.',
        UpstreamRequestRejected: 'Alma rejected the request.',
        UnexpectedFailure: 'Unexpected failure.',
        SelectedPatron: 'Selected patron',
        SupportId: 'Support ID: {{errorId}}',
      },
    });
    translate.use('en');
    service = TestBed.inject(MutationFeedbackService);
  });

  it('preserves successful values and shows the standard success alert', () => {
    const value = { result: 'confirmed' };
    let result: typeof value | undefined;

    of(value)
      .pipe(service.handle('Success'))
      .subscribe((next) => (result = next));

    expect(result).toBe(value);
    expect(alert.success).toHaveBeenCalledOnceWith(
      'Saved',
      SUCCESS_ALERT_OPTIONS,
    );
  });

  it('shows sanitized warnings without support IDs and completes the stream', () => {
    let completed = false;
    let emitted = false;

    throwError(
      () =>
        new HttpErrorResponse({
          status: 400,
          error: {
            type: 'INVALID_INVOICE_POSTAL_ADDRESS',
            errorId: 'support-123',
            context: {},
          },
        }),
    )
      .pipe(service.handle('Success'))
      .subscribe({
        next: () => (emitted = true),
        complete: () => (completed = true),
      });

    expect(emitted).toBeFalse();
    expect(completed).toBeTrue();
    expect(alert.warn).toHaveBeenCalledOnceWith(
      'Invalid invoice address.',
      PERSISTENT_ALERT_OPTIONS,
    );
  });

  it('shows unexpected failures as persistent errors without leaking details', () => {
    throwError(() => new Error('private upstream detail'))
      .pipe(service.handle('Success'))
      .subscribe();

    expect(alert.error).toHaveBeenCalledOnceWith(
      'Unexpected failure.',
      PERSISTENT_ALERT_OPTIONS,
    );
    expect(alert.warn).not.toHaveBeenCalled();
  });

  it('shows an Alma rejection as a persistent error with its support id', () => {
    throwError(
      () =>
        new HttpErrorResponse({
          status: 502,
          error: {
            type: 'UPSTREAM_REQUEST_REJECTED',
            errorId: 'support-rejected-502',
            context: {},
          },
        }),
    )
      .pipe(service.handle('Success'))
      .subscribe();

    expect(alert.error).toHaveBeenCalledOnceWith(
      'Alma rejected the request. Support ID: support-rejected-502',
      PERSISTENT_ALERT_OPTIONS,
    );
    expect(alert.warn).not.toHaveBeenCalled();
  });
});
