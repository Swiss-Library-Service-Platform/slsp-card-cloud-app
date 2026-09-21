import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  defer,
  EMPTY,
  finalize,
  Observable,
  Subject,
  shareReplay,
} from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MutationActivityService {
  public readonly busy$: Observable<boolean>;
  public readonly eligibilityRefresh$ = new Subject<void>();
  private readonly alert = inject(AlertService);
  private readonly active = new BehaviorSubject(false);

  public constructor() {
    this.busy$ = this.active.asObservable();
  }

  public get busy(): boolean {
    return this.active.value;
  }

  public run<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => {
      if (this.busy) {
        return EMPTY;
      }
      this.active.next(true);
      this.alert.clear();

      return defer(request).pipe(finalize(() => this.active.next(false)));
    }).pipe(
      // Keep the request and guard alive if navigation destroys its initiating view.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
