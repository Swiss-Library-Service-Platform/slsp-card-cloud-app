import { TestBed } from '@angular/core/testing';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { Subject, of, tap } from 'rxjs';
import { MutationActivityService } from './mutation-activity.service';

describe('MutationActivityService', () => {
  it('clears old results only when an accepted request starts and preserves its result', () => {
    const alert = jasmine.createSpyObj<AlertService>('AlertService', [
      'clear',
      'success',
    ]);

    TestBed.configureTestingModule({
      providers: [{ provide: AlertService, useValue: alert }],
    });

    const service = TestBed.inject(MutationActivityService);
    const pending = new Subject<void>();
    const request = service.run(() => pending);

    expect(alert.clear).not.toHaveBeenCalled();
    request.pipe(tap(() => alert.success('done'))).subscribe();
    expect(alert.clear).toHaveBeenCalledTimes(1);
    expect(service.busy).toBeTrue();

    const blocked = jasmine.createSpy('blocked').and.returnValue(of(null));

    service.run(blocked).subscribe();
    expect(blocked).not.toHaveBeenCalled();
    expect(alert.clear).toHaveBeenCalledTimes(1);
    pending.next();
    pending.complete();
    expect(alert.success).toHaveBeenCalledWith('done');
    expect(alert.clear).toHaveBeenCalledTimes(1);
    expect(service.busy).toBeFalse();
  });
});
