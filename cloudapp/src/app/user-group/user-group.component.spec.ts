import { TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { AppModule } from '../app.module';
import { Observable, of, Subject, throwError, catchError, EMPTY } from 'rxjs';
import { UserGroupComponent } from './user-group.component';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronStateService,
  PatronMutationContext,
} from '../services/patron-state.service';
import { CardErrorService } from '../services/card-error.service';
import { MutationFeedbackService } from '../services/mutation-feedback.service';
import { CardPatron } from '../models/card-api.model';

describe('UserGroupComponent', () => {
  let component: UserGroupComponent;
  let api: jasmine.SpyObj<PatronApiService>;
  let state: jasmine.SpyObj<PatronStateService>;
  let feedbackErrors: unknown[];
  const context = { patronId: 'org-1' } as PatronMutationContext;

  beforeEach(() => {
    feedbackErrors = [];
    api = jasmine.createSpyObj('api', [
      'getEligibleUserGroups',
      'setUserGroup',
    ]);
    api.getEligibleUserGroups.and.returnValue(
      of({
        eligibleGroups: [
          { code: '01', displayName: 'Group', description: 'Details' },
        ],
      }),
    );
    state = jasmine.createSpyObj('state', [
      'currentMutationContext',
      'replacePatron',
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
              afterClosed: (): Observable<boolean> => of(true),
            }),
          },
        },
        CardErrorService,
        {
          provide: MutationFeedbackService,
          useValue: {
            handle:
              (): (<T>(source: Observable<T>) => Observable<T>) =>
              <T>(source: Observable<T>): Observable<T> =>
                source.pipe(
                  catchError((error: unknown) => {
                    feedbackErrors.push(error);

                    return EMPTY;
                  }),
                ),
          },
        },
      ],
    });

    const translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      Errors: {
        UnexpectedFailure: 'Unavailable',
        AlmaRequestRejectedWithMessages: 'Alma rejected the request:',
        SupportId: 'Support ID: {{errorId}}',
      },
    });
    translate.use('en');
    component = TestBed.runInInjectionContext(() => new UserGroupComponent());
    component.patron = { currentUserGroupCode: '02' } as CardPatron;
  });
  it('loads organizational eligibility, preserves the current selection absent from choices and shows the sole alternative', () => {
    component.ngOnChanges();
    expect(component.groups.length).toBe(1);
    expect(component.selectedCode).toBe('02');
    expect(component.canSave).toBeFalse();
    component.selectedCode = '01';
    expect(component.canSave).toBeTrue();
  });
  it('disables saving when eligibility fails', () => {
    api.getEligibleUserGroups.and.returnValue(
      throwError(() => new Error('upstream')),
    );
    component.ngOnChanges();
    expect(component.error).toBe('Unavailable');
    expect(component.canSave).toBeFalse();
  });
  it('renders literal upstream messages and one support reference, and clears them when retrying', () => {
    const supportId = 'fad72b4a-8761-4d60-b621-f767f08998a0';
    const pending = new Subject<{ eligibleGroups: [] }>();
    const translate = TestBed.inject(TranslateService);

    translate.setTranslation(
      'en',
      {
        Errors: { SupportId: 'Support ID: {{errorId}}' },
      },
      true,
    );
    translate.use('en');
    api.getEligibleUserGroups.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 502,
            error: {
              type: 'ALMA_REQUEST_REJECTED',
              errorId: supportId,
              messages: ['<b>Invalid & value</b>', 'Second detail'],
            },
          }),
      ),
    );

    const fixture = TestBed.createComponent(UserGroupComponent);

    fixture.componentRef.setInput('patron', { currentUserGroupCode: '01' });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain('Alma rejected the request:');
    expect(
      fixture.nativeElement.querySelector('.slsp-support-reference')
        ?.textContent,
    ).toContain(supportId);

    const alert = fixture.nativeElement.querySelector('[role="alert"]');

    expect(alert.textContent).toContain('<b>Invalid & value</b>');
    expect(alert.textContent).toContain('Second detail');
    expect(alert.querySelector('b')).toBeNull();
    expect(alert.querySelectorAll('br').length).toBe(2);
    expect(alert.textContent.split(supportId).length - 1).toBe(1);

    api.getEligibleUserGroups.and.returnValue(pending);
    fixture.nativeElement.querySelector('[data-action="retry-groups"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.slsp-support-reference'),
    ).toBeNull();
    pending.complete();
  });
  it('retains an unsaved group across unrelated patron replacement', () => {
    component.ngOnChanges();
    component.selectedCode = '01';
    component.patron = { ...component.patron, fullName: 'Updated name' };
    component.ngOnChanges();
    expect(component.selectedCode).toBe('01');
    expect(api.getEligibleUserGroups).toHaveBeenCalledTimes(1);
  });
  it('ignores eligibility arriving for a previous selection', () => {
    const response = new Subject<{ eligibleGroups: [] }>();

    api.getEligibleUserGroups.and.returnValue(response);
    component.ngOnChanges();
    state.currentMutationContext.and.returnValue({
      patronId: 'other',
    } as PatronMutationContext);
    response.next({ eligibleGroups: [] });
    expect(component.groups).toEqual([]);
  });
  it('renders a single eligible group without a dropdown and retains a separate current group', () => {
    const fixture = TestBed.createComponent(UserGroupComponent);

    fixture.componentRef.setInput('patron', {
      currentUserGroupCode: '02',
      currentUserGroupDescription: 'Current group',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-select')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Current group');
    expect(fixture.nativeElement.textContent).toContain('Group');
    expect(fixture.nativeElement.textContent).toContain('Details');
  });

  it('renders descriptions as text and disables save during loading', () => {
    const pending = new Subject<{
      eligibleGroups: {
        code: string;
        displayName: string;
        description: string;
      }[];
    }>();

    api.getEligibleUserGroups.and.returnValue(pending);

    const fixture = TestBed.createComponent(UserGroupComponent);

    fixture.componentRef.setInput('patron', { currentUserGroupCode: '01' });
    fixture.detectChanges();
    expect(fixture.componentInstance.canSave).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    pending.next({
      eligibleGroups: [
        { code: '01', displayName: 'One', description: '<b>plain text</b>' },
        { code: '02', displayName: 'Two', description: 'Alternative' },
      ],
    });
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-select')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('<b>plain text</b>');
    expect(fixture.nativeElement.querySelector('b')).toBeNull();
  });

  it('preserves selection after a failed save and accepts backend-confirmed group after success', () => {
    component.ngOnChanges();
    component.selectedCode = '01';
    api.setUserGroup.and.returnValue(
      throwError(() => new Error('unavailable')),
    );
    component.save();
    expect(component.selectedCode).toBe('01');
    expect(component.saving).toBeFalse();

    const confirmed = { currentUserGroupCode: '03' } as CardPatron;

    api.setUserGroup.and.returnValue(of(confirmed));
    component.save();
    expect(component.selectedCode).toBe('03');
    expect(state.replacePatron).toHaveBeenCalledOnceWith(confirmed, context);
  });
  it('does not show a previous selection’s save error on the new patron', () => {
    const pending = new Subject<CardPatron>();

    api.setUserGroup.and.returnValue(pending);
    component.ngOnChanges();
    component.selectedCode = '01';
    component.save();
    state.currentMutationContext.and.returnValue({
      patronId: 'other',
    } as PatronMutationContext);
    pending.error(new Error('previous patron failure'));
    expect(feedbackErrors).toEqual([]);
  });

  it('reloads changed eligibility after a save conflict without discarding the selected code', () => {
    component.ngOnChanges();
    component.selectedCode = '01';
    api.getEligibleUserGroups.and.returnValue(
      of({
        eligibleGroups: [
          { code: '03', displayName: 'New group', description: '' },
        ],
      }),
    );
    api.setUserGroup.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              type: 'USER_GROUP_NOT_ELIGIBLE',
              errorId: 'test-error',
              messages: [],
            },
          }),
      ),
    );
    component.save();
    expect(component.groups.map((group) => group.code)).toEqual(['03']);
    expect(component.selectedCode).toBe('01');
    expect(component.canSave).toBeFalse();
  });
});
