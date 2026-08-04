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
    [401, 'authentication'],
    [403, 'authorization'],
  ] as const;

  denials.forEach(([status, reason]) => {
    it(`maps a typed HTTP ${status} to ${reason} denial with its support id`, (done) => {
      const error: CardApiError = {
        type:
          reason === 'authentication'
            ? 'AUTHENTICATION_FAILED'
            : 'ACCESS_DENIED',
        errorId: `support-${status}`,
        context: {},
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
        context: {},
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
        context: {},
      });
      done();
    });
  });

  it('does not turn a malformed HTTP 401 body into an access denial', (done) => {
    backend.get.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: {
              type: 'AUTHENTICATION_FAILED',
              errorId: '<unsafe>',
              context: { detail: 'private backend detail' },
            },
          }),
      ),
    );

    service.check().subscribe((result) => {
      expect(result).toEqual({
        status: 'error',
        error: {
          type: 'UNEXPECTED_FAILURE',
          errorId: '',
          context: {},
        },
      });
      done();
    });
  });
});
