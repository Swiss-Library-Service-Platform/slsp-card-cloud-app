import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

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

  it('adds a library card number with its typed request body', (done) => {
    service.addLibraryCardNumber('p', 'ABC').subscribe((result) => {
      expect(result).toBe(patron);
      expect(backend.post).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p/library-card-numbers',
        { value: 'ABC' },
      );
      done();
    });
  });

  it('removes a library card number with encoded path segments', (done) => {
    service.removeLibraryCardNumber('p/q', 'selector/value').subscribe(() => {
      expect(backend.delete).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p%2Fq/library-card-numbers/selector%2Fvalue',
      );
      done();
    });
  });

  it('adds a block with its typed request body', (done) => {
    service.addBlock('p', '09', 'reason').subscribe(() => {
      expect(backend.post).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p/blocks',
        { code: '09', comment: 'reason' },
      );
      done();
    });
  });

  it('removes a block with encoded path segments', (done) => {
    service.removeBlock('p/q', 'selector/value').subscribe(() => {
      expect(backend.delete).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p%2Fq/blocks/selector%2Fvalue',
      );
      done();
    });
  });

  it('sets a preferred address with an encoded patron path segment', (done) => {
    service.setPreferredAddress('p/q', 'selector').subscribe(() => {
      expect(backend.put).toHaveBeenCalledOnceWith(
        '/api/v1/patrons/p%2Fq/preferred-address',
        { selector: 'selector' },
      );
      done();
    });
  });
});
