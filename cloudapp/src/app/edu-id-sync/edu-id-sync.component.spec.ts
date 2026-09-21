import { HttpErrorResponse } from '@angular/common/http';
import { fakeAsync, flush, tick, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { AppModule } from '../app.module';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { Observable, of, Subject, throwError } from 'rxjs';
import { EduIdSyncService } from './edu-id-sync.service';
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
      error: { type, errorId: 'test-error', messages: [] },
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
      imports: [AppModule, NoopAnimationsModule],
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
  it('keeps an old banner when synchronization confirmation is cancelled', () => {
    component.sync();
    confirmation.next(false);
    expect(api.syncEduId).not.toHaveBeenCalled();
    expect(TestBed.inject(AlertService).clear).not.toHaveBeenCalled();
  });

  it('holds shared busy through a failed recovery refresh and retains recovery', () => {
    api.syncEduId.and.returnValue(
      throwError(() => failure('SYNC_REFRESH_FAILED', 502)),
    );
    component.sync();
    confirmation.next(true);

    const pending = new Subject<CardPatron>();

    api.getPatron.and.returnValue(pending);

    const sync = TestBed.inject(EduIdSyncService);
    const activity = TestBed.inject(MutationActivityService);

    sync.refresh();
    expect(activity.busy).toBeTrue();
    pending.error(failure('UNEXPECTED_FAILURE', 500));
    expect(activity.busy).toBeFalse();
    expect(sync.needsRefresh).toBeTrue();
    expect(sync.loading).toBeFalse();
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
      TestBed.inject(EduIdSyncService).refresh();
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
    TestBed.inject(EduIdSyncService).refresh();
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

  it('opens the patron menu before requesting confirmation', fakeAsync(() => {
    const fixture = TestBed.createComponent(EduIdSyncComponent);

    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '[data-patron-actions]',
    ) as HTMLButtonElement;

    expect(trigger).not.toBeNull();
    trigger.click();
    fixture.detectChanges();
    tick();

    const item = document.querySelector(
      '[role="menuitem"]',
    ) as HTMLButtonElement;

    expect(item.textContent).toContain('EduIdSync.Action');
    item.click();
    fixture.detectChanges();
    tick(500);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(api.syncEduId).not.toHaveBeenCalled();
    confirmation.next(false);
    expect(api.syncEduId).not.toHaveBeenCalled();
  }));

  it('closes the menu on Escape and restores focus to the trigger', fakeAsync(() => {
    const fixture = TestBed.createComponent(EduIdSyncComponent);

    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '[data-patron-actions]',
    ) as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    tick();

    const item = document.querySelector(
      '[role="menuitem"]',
    ) as HTMLButtonElement;

    item.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );
    fixture.detectChanges();
    tick();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(api.syncEduId).not.toHaveBeenCalled();
    flush();
  }));

  it('disables the patron menu during another mutation', () => {
    const fixture = TestBed.createComponent(EduIdSyncComponent);
    const pending = new Subject<void>();

    TestBed.inject(MutationActivityService)
      .run(() => pending)
      .subscribe();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-patron-actions]').disabled,
    ).toBeTrue();
    pending.complete();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-patron-actions]').disabled,
    ).toBeFalse();
  });

  it('removes the sync menu when recovery is required', () => {
    api.syncEduId.and.returnValue(
      throwError(() => failure('SYNC_REFRESH_FAILED', 502)),
    );

    const fixture = TestBed.createComponent(EduIdSyncComponent);

    fixture.detectChanges();
    fixture.componentInstance.sync();
    confirmation.next(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-patron-actions]'),
    ).toBeNull();
  });
});
