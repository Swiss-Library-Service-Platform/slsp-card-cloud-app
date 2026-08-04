import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

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
    it(`maps HTTP ${status} to ${reason} denial`, (done) => {
      backend.get.and.returnValue(
        throwError(() => new HttpErrorResponse({ status })),
      );

      service.check().subscribe((result) => {
        expect(result).toEqual({ status: 'denied', reason });
        done();
      });
    });
  });

  it('preserves an unknown failure as an error result', (done) => {
    const error = new Error('backend unavailable');

    backend.get.and.returnValue(throwError(() => error));

    service.check().subscribe((result) => {
      expect(result).toEqual({ status: 'error', error });
      done();
    });
  });

  it('preserves an unrecognized HTTP failure as an error result', (done) => {
    const error = new HttpErrorResponse({ status: 503 });

    backend.get.and.returnValue(throwError(() => error));

    service.check().subscribe((result) => {
      expect(result).toEqual({ status: 'error', error });
      done();
    });
  });
});
