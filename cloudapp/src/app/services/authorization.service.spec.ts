import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CardApiError } from '../models/card-api.model';
import { AuthorizationService } from './authorization.service';
import { BackendHttpService } from './backend-http.service';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let backend: jasmine.SpyObj<BackendHttpService>;

  beforeEach(() => {
    backend = jasmine.createSpyObj<BackendHttpService>('BackendHttpService', [
      'get',
    ]);

    TestBed.configureTestingModule({
      providers: [
        AuthorizationService,
        { provide: BackendHttpService, useValue: backend },
      ],
    });

    service = TestBed.inject(AuthorizationService);
  });

  it('maps a successful allowed request to allowed', (done) => {
    backend.get.and.returnValue(of(void 0));

    service.check().subscribe((result) => {
      expect(result).toEqual({ status: 'allowed' });
      expect(backend.get).toHaveBeenCalledOnceWith('/api/v1/allowed');
      done();
    });
  });

  const denials = [
    [401, 'authentication', 'AUTHENTICATION_FAILED'],
    [403, 'institution', 'INSTITUTION_NOT_ENABLED'],
    [403, 'role', 'OPERATOR_ROLE_REQUIRED'],
    [403, 'authorization', 'ACCESS_DENIED'],
  ] as const;

  denials.forEach(([status, reason, type]) => {
    it(`maps a typed HTTP ${status} to ${reason} denial with its support id`, (done) => {
      const error: CardApiError = {
        type,
        errorId: `support-${status}`,
        messages: [],
      };

      backend.get.and.returnValue(
        throwError(() => new HttpErrorResponse({ status, error })),
      );

      service.check().subscribe((result) => {
        expect(result).toEqual({ status: 'denied', reason, error });
        done();
      });
    });
  });

  it('recognizes an empty middleware 401 as an unverified session', (done) => {
    backend.get.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401 })),
    );
    service.check().subscribe((result) => {
      expect(result).toEqual({
        status: 'denied',
        reason: 'authentication',
        error: {
          type: 'AUTHENTICATION_FAILED',
          errorId: '',
          messages: [],
        },
      });
      done();
    });
  });

  it('normalizes an unknown failure to a safe generic error result', (done) => {
    const unsafe = new Error('private backend detail');

    backend.get.and.returnValue(throwError(() => unsafe));

    service.check().subscribe((result) => {
      if (result.status !== 'error') {
        done.fail(`expected an error result, got ${result.status}`);

        return;
      }

      expect(result.error).toEqual({
        type: 'UNEXPECTED_FAILURE',
        errorId: '',
        messages: [],
      });
      done();
    });
  });

  it('normalizes an untyped transport failure as an error result', (done) => {
    const response = new HttpErrorResponse({ status: 503 });

    backend.get.and.returnValue(throwError(() => response));

    service.check().subscribe((result) => {
      if (result.status !== 'error') {
        done.fail(`expected an error result, got ${result.status}`);

        return;
      }

      expect(result.error).toEqual({
        type: 'DEPENDENCY_UNAVAILABLE',
        errorId: '',
        messages: [],
      });
      done();
    });
  });

  it('uses HTTP 401 for session guidance while discarding malformed details', (done) => {
    backend.get.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: {
              type: 'AUTHENTICATION_FAILED',
              errorId: '<unsafe>',
              messages: [],
            },
          }),
      ),
    );

    service.check().subscribe((result) => {
      expect(result).toEqual({
        status: 'denied',
        reason: 'authentication',
        error: {
          type: 'AUTHENTICATION_FAILED',
          errorId: '',
          messages: [],
        },
      });
      done();
    });
  });
});
