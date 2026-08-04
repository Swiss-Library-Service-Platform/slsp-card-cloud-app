import { TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { LibraryManagementService } from './library-management.service';

describe('LibraryCardServiceService', () => {
  let service: LibraryManagementService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
    service = TestBed.inject(LibraryManagementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
