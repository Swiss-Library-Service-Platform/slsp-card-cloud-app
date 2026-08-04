import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { BackendHttpService } from './backend-http.service';

export type AuthorizationResult =
  | { readonly status: 'allowed' }
  | {
      readonly status: 'denied';
      readonly reason: 'authentication' | 'authorization';
    }
  | { readonly status: 'error'; readonly error: unknown };

@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly backend = inject(BackendHttpService);

  public check(): Observable<AuthorizationResult> {
    return this.backend.get<void>('/api/v1/allowed').pipe(
      map((): AuthorizationResult => ({ status: 'allowed' })),
      catchError((error: unknown): Observable<AuthorizationResult> => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return of({ status: 'denied', reason: 'authentication' });
        }

        if (error instanceof HttpErrorResponse && error.status === 403) {
          return of({ status: 'denied', reason: 'authorization' });
        }

        return of({ status: 'error', error });
      }),
    );
  }
}
