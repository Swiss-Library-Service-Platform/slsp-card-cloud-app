import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { CardPatron } from '../models/card-api.model';
import { BackendHttpService } from './backend-http.service';
import { PatronApiService } from './patron-api.service';

describe('PatronApiService', () => {
  let service: PatronApiService;
  let backend: jasmine.SpyObj<BackendHttpService>;
  const patron: CardPatron = {
    fullName: 'Test Patron',
    external: false,
    libraryCardNumbers: [],
    matriculationNumber: null,
    dashedMatriculationNumber: null,
    blocks: {},
    postalAddresses: [],
  };

  beforeEach(() => {
    backend = jasmine.createSpyObj<BackendHttpService>('BackendHttpService', [
      'get',
      'post',
      'put',
      'delete',
    ]);
    backend.get.and.returnValue(of(patron));
    backend.post.and.returnValue(of(patron));
    backend.put.and.returnValue(of(patron));
    backend.delete.and.returnValue(of(patron));

    TestBed.configureTestingModule({
      providers: [
        PatronApiService,
        { provide: BackendHttpService, useValue: backend },
      ],
    });

    service = TestBed.inject(PatronApiService);
  });

  it('gets a patron with an encoded patron path segment', (done) => {
    service.getPatron('a/b').subscribe((result) => {
      expect(result).toBe(patron);
      expect(backend.get).toHaveBeenCalledOnceWith('/api/v1/patrons/a%2Fb');
      done();
    });
  });

  ['.', '..'].forEach((unsafeId) => {
    it(`rejects the traversal patron id ${unsafeId} before endpoint interpolation`, () => {
      expect(() => service.getPatron(unsafeId)).toThrowError(
        'Unsafe patron identifier',
      );
      expect(backend.get).not.toHaveBeenCalled();
    });
  });

  it('adds a library card number with its typed request body', (done) => {
    service.addLibraryCardNumber('p/q', 'ABC').subscribe((result) => {
      expect(result).toBe(patron);
      expect(backend.post).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p%2Fq/library-card-numbers',
        { value: 'ABC' },
      );
      done();
    });
  });

  it('removes a library card number with encoded path segments', (done) => {
    service
      .removeLibraryCardNumber('p/q', 'reference/value')
      .subscribe((result) => {
        expect(result).toBe(patron);
        expect(backend.delete).toHaveBeenCalledOnceWith(
          '/api/v1/patrons/p%2Fq/library-card-numbers/reference%2Fvalue',
        );
        done();
      });
  });

  it('adds a block with its typed request body', (done) => {
    service.addBlock('p/q', '09', 'reason').subscribe((result) => {
      expect(result).toBe(patron);
      expect(backend.post).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p%2Fq/blocks',
        { code: '09', comment: 'reason' },
      );
      done();
    });
  });

  it('removes a block with encoded path segments', (done) => {
    service.removeBlock('p/q', 'reference/value').subscribe((result) => {
      expect(result).toBe(patron);
      expect(backend.delete).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p%2Fq/blocks/reference%2Fvalue',
      );
      done();
    });
  });

  it('sets a preferred address with an encoded patron path segment', (done) => {
    service.setPreferredAddress('p/q', 'reference').subscribe((result) => {
      expect(result).toBe(patron);
      expect(backend.put).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p%2Fq/preferred-address',
        { elementReference: 'reference' },
      );
      done();
    });
  });

  const operations = [
    ['getPatron', (): Observable<CardPatron> => service.getPatron('p')],
    [
      'addLibraryCardNumber',
      (): Observable<CardPatron> => service.addLibraryCardNumber('p', 'ABC'),
    ],
    [
      'removeLibraryCardNumber',
      (): Observable<CardPatron> =>
        service.removeLibraryCardNumber('p', 'reference'),
    ],
    [
      'addBlock',
      (): Observable<CardPatron> => service.addBlock('p', '09', 'reason'),
    ],
    [
      'removeBlock',
      (): Observable<CardPatron> => service.removeBlock('p', 'reference'),
    ],
    [
      'setPreferredAddress',
      (): Observable<CardPatron> =>
        service.setPreferredAddress('p', 'reference'),
    ],
  ] as const;

  operations.forEach(([methodName, invoke]) => {
    it(`${methodName} forwards the exact backend error`, (done) => {
      const error = new Error(`${methodName} sentinel`);

      backend.get.and.returnValue(throwError(() => error));
      backend.post.and.returnValue(throwError(() => error));
      backend.put.and.returnValue(throwError(() => error));
      backend.delete.and.returnValue(throwError(() => error));

      invoke().subscribe({
        next: () => done.fail('expected the subscriber error channel'),
        error: (result: unknown) => {
          expect(result).toBe(error);
          done();
        },
        complete: () => done.fail('expected the subscriber error channel'),
      });
    });
  });
});
