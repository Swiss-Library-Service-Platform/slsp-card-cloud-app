import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { CardApiError } from '../models/card-api.model';
import { BackendHttpService } from './backend-http.service';
import {
  AccessDenialReason,
  accessDenialReason,
  normalizeCardError,
} from './card-error.service';

export type AuthorizationResult =
  | { readonly status: 'allowed' }
  | {
      readonly status: 'denied';
      readonly reason: AccessDenialReason;
      readonly error: CardApiError;
    }
  | { readonly status: 'error'; readonly error: CardApiError };

@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly backend = inject(BackendHttpService);

  public check(): Observable<AuthorizationResult> {
    return this.backend.get<void>('/api/v1/allowed').pipe(
      map((): AuthorizationResult => ({ status: 'allowed' })),
      catchError((error: unknown): Observable<AuthorizationResult> => {
        const apiError = normalizeCardError(error);
        const reason = accessDenialReason(apiError.type);

        if (reason) {
          return of({ status: 'denied', reason, error: apiError });
        }

        return of({ status: 'error', error: apiError });
      }),
    );
  }
}
