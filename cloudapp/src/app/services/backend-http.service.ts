import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CloudAppEventsService } from '@exlibris/exl-cloudapp-angular-lib';
import {
  combineLatest,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  take,
  tap,
} from 'rxjs';

interface BackendEnvironment {
  readonly baseUrl: string;
  readonly sandbox: boolean;
}

@Injectable({ providedIn: 'root' })
export class BackendHttpService {
  private static readonly LOCAL_URL = 'http://localhost:8080';
  private static readonly SANDBOX_URL = 'https://card-test.swisscovery.network';
  private static readonly PROD_URL = 'https://card.swisscovery.network';
  private static readonly TOKEN_TTL_MS = 30_000;

  private readonly events = inject(CloudAppEventsService);
  private readonly http = inject(HttpClient);

  private cachedToken: string | null = null;
  private environmentCache$: Observable<BackendEnvironment> | null = null;
  private tokenExpiry = 0;
  private tokenInFlight$: Observable<string> | null = null;

  public get<T>(path: string, params?: HttpParams): Observable<T> {
    this.assertCardPath(path);

    return this.withAuth((token, baseUrl) =>
      this.http.get<T>(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
    );
  }

  public post<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Observable<TResponse> {
    this.assertCardPath(path);

    return this.withAuth((token, baseUrl) =>
      this.http.post<TResponse>(`${baseUrl}${path}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  public put<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Observable<TResponse> {
    this.assertCardPath(path);

    return this.withAuth((token, baseUrl) =>
      this.http.put<TResponse>(`${baseUrl}${path}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  public delete<T>(path: string): Observable<T> {
    this.assertCardPath(path);

    return this.withAuth((token, baseUrl) =>
      this.http.delete<T>(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  public isSandbox$(): Observable<boolean> {
    return this.getEnvironment().pipe(map(({ sandbox }) => sandbox));
  }

  private assertCardPath(path: string): void {
    if (!path.startsWith('/api/v1/')) {
      throw new Error(`Card backend path must begin with /api/v1/: ${path}`);
    }
  }

  private getToken(): Observable<string> {
    if (this.cachedToken && performance.now() < this.tokenExpiry) {
      return of(this.cachedToken);
    }

    if (!this.tokenInFlight$) {
      const tokenRequest$ = this.events.getAuthToken().pipe(
        take(1),
        tap((token) => {
          this.cachedToken = token;
          this.tokenExpiry =
            performance.now() + BackendHttpService.TOKEN_TTL_MS;
        }),
        finalize(() => {
          if (this.tokenInFlight$ === tokenRequest$) {
            this.tokenInFlight$ = null;
          }
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

      this.tokenInFlight$ = tokenRequest$;
    }

    return this.tokenInFlight$;
  }

  private getEnvironment(): Observable<BackendEnvironment> {
    if (!this.environmentCache$) {
      this.environmentCache$ = this.events.getInitData().pipe(
        take(1),
        map((data): BackendEnvironment => {
          const almaUrl = data.urls.alma;
          const sandbox = /psb/i.test(almaUrl);
          const baseUrl = /localhost/i.test(almaUrl)
            ? BackendHttpService.LOCAL_URL
            : sandbox
              ? BackendHttpService.SANDBOX_URL
              : BackendHttpService.PROD_URL;

          return { baseUrl, sandbox };
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this.environmentCache$;
  }

  private withAuth<T>(
    request: (token: string, baseUrl: string) => Observable<T>,
  ): Observable<T> {
    return combineLatest([this.getToken(), this.getEnvironment()]).pipe(
      take(1),
      switchMap(([token, environment]) => request(token, environment.baseUrl)),
    );
  }
}
