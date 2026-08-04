import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { CardApiError } from '../models/card-api.model';
import { BackendHttpService } from './backend-http.service';
import { normalizeCardError } from './card-error.service';

export type AuthorizationResult =
  | { readonly status: 'allowed' }
  | {
      readonly status: 'denied';
      readonly reason: 'authentication' | 'authorization';
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

        if (apiError.type === 'AUTHENTICATION_FAILED') {
          return of({
            status: 'denied',
            reason: 'authentication',
            error: apiError,
          });
        }

        if (apiError.type === 'ACCESS_DENIED') {
          return of({
            status: 'denied',
            reason: 'authorization',
            error: apiError,
          });
        }

        return of({ status: 'error', error: apiError });
      }),
    );
  }
}
