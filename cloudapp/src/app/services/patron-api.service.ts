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
      `/api/v1/patrons/${encodeURIComponent(patronId)}`,
    );
  }

  public addLibraryCardNumber(
    patronId: string,
    value: string,
  ): Observable<CardPatron> {
    const request: AddLibraryCardNumberRequest = { value };

    return this.backend.post<CardPatron, AddLibraryCardNumberRequest>(
      `/api/v1/patrons/${encodeURIComponent(patronId)}/library-card-numbers`,
      request,
    );
  }

  public removeLibraryCardNumber(
    patronId: string,
    selector: string,
  ): Observable<CardPatron> {
    return this.backend.delete<CardPatron>(
      `/api/v1/patrons/${encodeURIComponent(patronId)}/library-card-numbers/${encodeURIComponent(selector)}`,
    );
  }

  public addBlock(
    patronId: string,
    code: AddableBlockCode,
    comment: string,
  ): Observable<CardPatron> {
    const request: AddBlockRequest = { code, comment };

    return this.backend.post<CardPatron, AddBlockRequest>(
      `/api/v1/patrons/${encodeURIComponent(patronId)}/blocks`,
      request,
    );
  }

  public removeBlock(
    patronId: string,
    selector: string,
  ): Observable<CardPatron> {
    return this.backend.delete<CardPatron>(
      `/api/v1/patrons/${encodeURIComponent(patronId)}/blocks/${encodeURIComponent(selector)}`,
    );
  }

  public setPreferredAddress(
    patronId: string,
    selector: string,
  ): Observable<CardPatron> {
    const request: SetPreferredAddressRequest = { selector };

    return this.backend.put<CardPatron, SetPreferredAddressRequest>(
      `/api/v1/patrons/${encodeURIComponent(patronId)}/preferred-address`,
      request,
    );
  }
}
