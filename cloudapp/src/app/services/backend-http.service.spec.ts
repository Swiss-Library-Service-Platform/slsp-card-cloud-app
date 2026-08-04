import { HttpParams } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  CloudAppEventsService,
  InitData,
} from '@exlibris/exl-cloudapp-angular-lib';
import { Observable, Subject, of, throwError } from 'rxjs';

import { BackendHttpService } from './backend-http.service';

interface TestResponse {
  readonly result: string;
}

interface TestRequest {
  readonly value: string;
}

interface BackendCall {
  readonly name: string;
  readonly invoke: (
    service: BackendHttpService,
    path: string,
  ) => Observable<unknown>;
}

describe('BackendHttpService', () => {
  let service: BackendHttpService;
  let http: HttpTestingController;
  let events: jasmine.SpyObj<CloudAppEventsService>;
  const initData = (almaUrl: string): InitData => ({
    user: {
      firstName: 'Test',
      lastName: 'Operator',
      primaryId: 'operator-1',
      currentlyAtLibCode: 'TEST',
      currentlyAtCircDesk: 'DEFAULT',
      currentlyAtDept: '',
      isAdmin: false,
    },
    lang: 'en',
    instCode: '41SLSP_NETWORK',
    urls: { alma: almaUrl },
    color: '#ffffff',
  });

  beforeEach(() => {
    events = jasmine.createSpyObj<CloudAppEventsService>(
      'CloudAppEventsService',
      ['getInitData', 'getAuthToken'],
    );
    events.getInitData.and.returnValue(
      of(initData('https://eu01.alma.exlibrisgroup.com')),
    );
    events.getAuthToken.and.returnValue(of('signed-token'));

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        BackendHttpService,
        { provide: CloudAppEventsService, useValue: events },
      ],
    });

    service = TestBed.inject(BackendHttpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  [
    ['https://localhost:4200', 'http://localhost:8080'],
    [
      'https://eu01-psb.alma.exlibrisgroup.com',
      'https://card-test.swisscovery.network',
    ],
    ['https://eu01.alma.exlibrisgroup.com', 'https://card.swisscovery.network'],
    [
      'HTTPS://EU01-PSB.ALMA.EXLIBRISGROUP.COM',
      'https://card-test.swisscovery.network',
    ],
  ].forEach(([almaUrl, expected]) => {
    it(`maps ${almaUrl} to ${expected}`, () => {
      events.getInitData.and.returnValue(of(initData(almaUrl)));

      service.get<void>('/api/v1/allowed').subscribe();

      const request = http.expectOne(`${expected}/api/v1/allowed`);

      expect(request.request.url).toBe(`${expected}/api/v1/allowed`);
      request.flush(null);
    });
  });

  it('shares one SDK token request between concurrent backend requests', () => {
    const token$ = new Subject<string>();

    events.getAuthToken.and.returnValue(token$);

    service.get<void>('/api/v1/allowed').subscribe();
    service.get<void>('/api/v1/patrons/123').subscribe();

    expect(events.getAuthToken).toHaveBeenCalledTimes(1);
    expect(http.match(() => true)).toEqual([]);

    token$.next('shared-token');
    token$.complete();

    const requests = http.match(() => true);

    expect(requests.length).toBe(2);
    expect(
      requests.every(
        (request) =>
          request.request.headers.get('Authorization') ===
          'Bearer shared-token',
      ),
    ).toBeTrue();
    requests.forEach((request) => request.flush(null));
  });

  it('fetches a new token after the 30 second cache lifetime', () => {
    let now = 1_000;

    spyOn(performance, 'now').and.callFake(() => now);
    events.getAuthToken.and.returnValues(of('first-token'), of('second-token'));

    service.get<void>('/api/v1/allowed').subscribe();

    const firstRequest = http.expectOne(
      'https://card.swisscovery.network/api/v1/allowed',
    );

    expect(firstRequest.request.headers.get('Authorization')).toBe(
      'Bearer first-token',
    );
    firstRequest.flush(null);

    now += 30_000;
    service.get<void>('/api/v1/allowed').subscribe();

    const secondRequest = http.expectOne(
      'https://card.swisscovery.network/api/v1/allowed',
    );

    expect(secondRequest.request.headers.get('Authorization')).toBe(
      'Bearer second-token',
    );
    secondRequest.flush(null);

    expect(events.getAuthToken).toHaveBeenCalledTimes(2);
  });

  it('clears a failed in-flight token request so the next call can retry', () => {
    const tokenError = new Error('SDK token failure');

    events.getAuthToken.and.returnValues(
      throwError(() => tokenError),
      of('recovered-token'),
    );

    let receivedError: unknown;

    service.get<void>('/api/v1/allowed').subscribe({
      error: (error: unknown) => {
        receivedError = error;
      },
    });

    expect(receivedError).toBe(tokenError);
    expect(http.match(() => true)).toEqual([]);

    service.get<void>('/api/v1/allowed').subscribe();

    const request = http.expectOne(
      'https://card.swisscovery.network/api/v1/allowed',
    );

    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer recovered-token',
    );
    request.flush(null);
    expect(events.getAuthToken).toHaveBeenCalledTimes(2);
  });

  it('sends authorization without a legacy environment query parameter', () => {
    service
      .get<TestResponse>(
        '/api/v1/patrons/123',
        new HttpParams().set('view', 'complete'),
      )
      .subscribe((response) => {
        expect(response).toEqual({ result: 'ok' });
      });

    const request = http.expectOne(
      'https://card.swisscovery.network/api/v1/patrons/123?view=complete',
    );

    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer signed-token',
    );
    expect(request.request.params.has('isProdEnvironment')).toBeFalse();
    request.flush({ result: 'ok' });
  });

  it('forwards typed request bodies for mutations', () => {
    const body: TestRequest = { value: 'SLSP-123456789' };

    service
      .post<TestResponse, TestRequest>('/api/v1/patrons/123/numbers', body)
      .subscribe();

    const post = http.expectOne(
      'https://card.swisscovery.network/api/v1/patrons/123/numbers',
    );

    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(body);
    post.flush({ result: 'created' });

    service
      .put<TestResponse, TestRequest>('/api/v1/patrons/123/settings', body)
      .subscribe();

    const put = http.expectOne(
      'https://card.swisscovery.network/api/v1/patrons/123/settings',
    );

    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(body);
    put.flush({ result: 'updated' });

    service
      .delete<TestResponse>('/api/v1/patrons/123/numbers/selector')
      .subscribe();

    const deletion = http.expectOne(
      'https://card.swisscovery.network/api/v1/patrons/123/numbers/selector',
    );

    expect(deletion.request.method).toBe('DELETE');
    deletion.flush({ result: 'deleted' });
  });

  it('shares one case-insensitive environment lookup with sandbox status', () => {
    events.getInitData.and.returnValue(
      of(initData('HTTPS://EU01-PSB.ALMA.EXLIBRISGROUP.COM')),
    );

    let sandbox: boolean | undefined;

    service.isSandbox$().subscribe((value) => {
      sandbox = value;
    });
    service.get<void>('/api/v1/allowed').subscribe();

    expect(sandbox).toBeTrue();
    expect(events.getInitData).toHaveBeenCalledTimes(1);
    http
      .expectOne('https://card-test.swisscovery.network/api/v1/allowed')
      .flush(null);
  });

  const invalidPathCalls: readonly BackendCall[] = [
    {
      name: 'GET',
      invoke: (backend, path) => backend.get<unknown>(path),
    },
    {
      name: 'POST',
      invoke: (backend, path) =>
        backend.post<unknown, TestRequest>(path, { value: 'value' }),
    },
    {
      name: 'PUT',
      invoke: (backend, path) =>
        backend.put<unknown, TestRequest>(path, { value: 'value' }),
    },
    {
      name: 'DELETE',
      invoke: (backend, path) => backend.delete<unknown>(path),
    },
  ];

  [
    'api/v1/allowed',
    '/api/v1',
    '/api/v10/allowed',
    '/other/api/v1/allowed',
  ].forEach((path) => {
    invalidPathCalls.forEach(({ name, invoke }) => {
      it(`rejects ${name} ${path} before SDK or HTTP side effects`, () => {
        expect(() => invoke(service, path)).toThrowError(
          `Card backend path must begin with /api/v1/: ${path}`,
        );
        expect(events.getAuthToken).not.toHaveBeenCalled();
        expect(events.getInitData).not.toHaveBeenCalled();
        expect(http.match(() => true)).toEqual([]);
      });
    });
  });
});
