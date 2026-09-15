import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { AppModule } from '../app.module';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { Observable, of, Subject, throwError } from 'rxjs';
import { EduIdSyncComponent } from './edu-id-sync.component';
import { CardPatron } from '../models/card-api.model';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronStateService,
  PatronMutationContext,
} from '../services/patron-state.service';
import { MutationActivityService } from '../services/mutation-activity.service';

describe('EduIdSyncComponent', () => {
  let component: EduIdSyncComponent;
  let api: jasmine.SpyObj<PatronApiService>;
  let state: jasmine.SpyObj<PatronStateService>;
  let confirmation: Subject<boolean>;
  const context = { patronId: '123@eduid.ch' } as PatronMutationContext;
  const patron = {} as CardPatron;
  const failure = (type: string, status: number): HttpErrorResponse =>
    new HttpErrorResponse({
      status,
      error: { type, errorId: 'test-error', context: {} },
    });

  beforeEach(() => {
    confirmation = new Subject<boolean>();
    api = jasmine.createSpyObj('api', ['syncEduId', 'getPatron']);
    state = jasmine.createSpyObj('state', [
      'currentMutationContext',
      'replacePatron',
      'clear',
    ]);
    state.currentMutationContext.and.returnValue(context);
    TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: PatronApiService, useValue: api },
        { provide: PatronStateService, useValue: state },
        {
          provide: MatDialog,
          useValue: {
            open: (): { afterClosed: () => Observable<boolean> } => ({
              afterClosed: (): Observable<boolean> => confirmation,
            }),
          },
        },
        {
          provide: AlertService,
          useValue: jasmine.createSpyObj('alert', [
            'success',
            'warn',
            'error',
            'clear',
          ]),
        },
      ],
    });
    component = TestBed.runInInjectionContext(() => new EduIdSyncComponent());
  });
  it('limits visibility to numeric edu-ID identifiers', () => {
    expect(component.supported).toBeTrue();
    state.currentMutationContext.and.returnValue({
      patronId: '123@test.eduid.ch',
    } as PatronMutationContext);
    expect(component.supported).toBeTrue();
    state.currentMutationContext.and.returnValue({
      patronId: 'org@eduid.ch',
    } as PatronMutationContext);
    expect(component.supported).toBeFalse();
  });
  it('requires confirmation then replaces patron and refreshes eligibility after completion', () => {
    api.syncEduId.and.returnValue(of(patron));

    let refreshed = false;

    TestBed.inject(MutationActivityService).eligibilityRefresh$.subscribe(
      () => {
        refreshed = true;
      },
    );
    component.sync();
    expect(api.syncEduId).not.toHaveBeenCalled();
    confirmation.next(true);
    expect(state.replacePatron).toHaveBeenCalledOnceWith(patron, context);
    expect(refreshed).toBeTrue();
  });
  it('does not sync if the selection changed while confirmation was open', () => {
    component.sync();
    state.currentMutationContext.and.returnValue({
      patronId: '456@eduid.ch',
    } as PatronMutationContext);
    confirmation.next(true);
    expect(api.syncEduId).not.toHaveBeenCalled();
  });
  ['SYNC_OUTCOME_UNKNOWN', 'SYNC_REFRESH_FAILED'].forEach((type) => {
    it(`offers refresh without repeating sync after ${type}`, () => {
      api.syncEduId.and.returnValue(
        throwError(() =>
          failure(type, type === 'SYNC_OUTCOME_UNKNOWN' ? 503 : 502),
        ),
      );
      api.getPatron.and.returnValue(of(patron));
      component.sync();
      confirmation.next(true);
      expect(component.needsRefresh).toBeTrue();
      component.refresh();
      expect(TestBed.inject(AlertService).clear).toHaveBeenCalled();
      expect(component.needsRefresh).toBeFalse();
      expect(api.syncEduId).toHaveBeenCalledTimes(1);
      expect(api.getPatron).toHaveBeenCalledOnceWith(context.patronId);
      expect(state.replacePatron).toHaveBeenCalledOnceWith(patron, context);
    });
  });
  it('clears a patron no longer available after sync', () => {
    api.syncEduId.and.returnValue(
      throwError(() => failure('SYNC_PATRON_UNAVAILABLE', 404)),
    );
    component.sync();
    confirmation.next(true);
    expect(state.clear).toHaveBeenCalledTimes(1);
  });
  it('ignores late sync failure after selecting another patron', () => {
    const pending = new Subject<CardPatron>();

    api.syncEduId.and.returnValue(pending);
    component.sync();
    confirmation.next(true);
    state.currentMutationContext.and.returnValue({
      patronId: '456@eduid.ch',
    } as PatronMutationContext);
    pending.error(failure('SYNC_PATRON_UNAVAILABLE', 404));
    expect(state.clear).not.toHaveBeenCalled();
  });
  it('offers refresh after a browser connection loss without retrying sync', () => {
    api.syncEduId.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    component.sync();
    confirmation.next(true);
    expect(component.needsRefresh).toBeTrue();
    expect(api.syncEduId).toHaveBeenCalledTimes(1);
  });

  it('keeps recovery available after destroying the initiating view and reselecting the patron', () => {
    const pending = new Subject<CardPatron>();

    api.syncEduId.and.returnValue(pending);

    const fixture = TestBed.createComponent(EduIdSyncComponent);

    fixture.componentInstance.sync();
    confirmation.next(true);
    fixture.destroy();
    state.currentMutationContext.and.returnValue({
      patronId: context.patronId,
    } as PatronMutationContext);
    pending.error(failure('SYNC_REFRESH_FAILED', 502));

    const reopened = TestBed.createComponent(EduIdSyncComponent);

    expect(reopened.componentInstance.needsRefresh).toBeTrue();
    expect(TestBed.inject(AlertService).error).toHaveBeenCalled();
    api.getPatron.and.returnValue(of(patron));
    reopened.componentInstance.refresh();
    expect(api.syncEduId).toHaveBeenCalledTimes(1);
    expect(reopened.componentInstance.needsRefresh).toBeFalse();
  });

  it('processes successful sync after the initiating view is destroyed', () => {
    const pending = new Subject<CardPatron>();

    api.syncEduId.and.returnValue(pending);

    const fixture = TestBed.createComponent(EduIdSyncComponent);

    fixture.componentInstance.sync();
    confirmation.next(true);
    fixture.destroy();
    pending.next(patron);
    pending.complete();
    expect(state.replacePatron).toHaveBeenCalledOnceWith(patron, context);
    expect(TestBed.inject(AlertService).success).toHaveBeenCalled();
  });

  it('keeps recovery after an unknown outcome while another patron is selected', () => {
    const pending = new Subject<CardPatron>();

    api.syncEduId.and.returnValue(pending);
    component.sync();
    confirmation.next(true);
    state.currentMutationContext.and.returnValue({
      patronId: '456@eduid.ch',
    } as PatronMutationContext);
    pending.error(failure('SYNC_OUTCOME_UNKNOWN', 503));
    expect(component.needsRefresh).toBeFalse();
    expect(TestBed.inject(AlertService).error).not.toHaveBeenCalled();
    state.currentMutationContext.and.returnValue({
      patronId: context.patronId,
    } as PatronMutationContext);
    expect(component.needsRefresh).toBeTrue();
  });

  it('renders the sync button, pending status and refresh recovery', () => {
    const pending = new Subject<CardPatron>();

    api.syncEduId.and.returnValue(pending);

    const fixture = TestBed.createComponent(EduIdSyncComponent);

    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;

    expect(button.textContent).toContain('EduIdSync.Action');
    button.click();
    confirmation.next(true);
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    pending.error(failure('SYNC_REFRESH_FAILED', 502));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain(
      'EduIdSync.Refresh',
    );
  });
});
