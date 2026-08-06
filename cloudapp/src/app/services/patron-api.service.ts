import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AddBlockRequest,
  AddLibraryCardNumberRequest,
  AddableBlockCode,
  CardPatron,
  SetPreferredAddressRequest,
} from '../models/card-api.model';
import { BackendHttpService } from './backend-http.service';

@Injectable({ providedIn: 'root' })
export class PatronApiService {
  private readonly backend = inject(BackendHttpService);

  public getPatron(patronId: string): Observable<CardPatron> {
    return this.backend.get<CardPatron>(
      `/api/v1/patrons/${encodePatronId(patronId)}`,
    );
  }

  public addLibraryCardNumber(
    patronId: string,
    value: string,
  ): Observable<CardPatron> {
    const request: AddLibraryCardNumberRequest = { value };

    return this.backend.post<CardPatron, AddLibraryCardNumberRequest>(
      `/api/v1/patrons/${encodePatronId(patronId)}/library-card-numbers`,
      request,
    );
  }

  public removeLibraryCardNumber(
    patronId: string,
    elementReference: string,
  ): Observable<CardPatron> {
    return this.backend.delete<CardPatron>(
      `/api/v1/patrons/${encodePatronId(patronId)}/library-card-numbers/${encodeURIComponent(elementReference)}`,
    );
  }

  public addBlock(
    patronId: string,
    code: AddableBlockCode,
    comment: string,
  ): Observable<CardPatron> {
    const request: AddBlockRequest = { code, comment };

    return this.backend.post<CardPatron, AddBlockRequest>(
      `/api/v1/patrons/${encodePatronId(patronId)}/blocks`,
      request,
    );
  }

  public removeBlock(
    patronId: string,
    elementReference: string,
  ): Observable<CardPatron> {
    return this.backend.delete<CardPatron>(
      `/api/v1/patrons/${encodePatronId(patronId)}/blocks/${encodeURIComponent(elementReference)}`,
    );
  }

  public setPreferredAddress(
    patronId: string,
    elementReference: string,
  ): Observable<CardPatron> {
    const request: SetPreferredAddressRequest = { elementReference };

    return this.backend.put<CardPatron, SetPreferredAddressRequest>(
      `/api/v1/patrons/${encodePatronId(patronId)}/preferred-address`,
      request,
    );
  }
}

function encodePatronId(patronId: string): string {
  if (patronId === '.' || patronId === '..') {
    throw new Error('Unsafe patron identifier');
  }

  return encodeURIComponent(patronId);
}
