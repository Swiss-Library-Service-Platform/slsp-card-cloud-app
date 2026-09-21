import { Component, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import {
  EMPTY,
  catchError,
  filter,
  finalize,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { ConfirmationdialogComponent } from '../confirmationdialog/confirmationdialog.component';
import { CardPatron, EligibleUserGroup } from '../models/card-api.model';
import {
  CardErrorService,
  normalizeCardError,
} from '../services/card-error.service';
import { MutationActivityService } from '../services/mutation-activity.service';
import { MutationFeedbackService } from '../services/mutation-feedback.service';
import { PatronApiService } from '../services/patron-api.service';
import {
  PatronMutationContext,
  PatronStateService,
} from '../services/patron-state.service';

@Component({
  selector: 'app-user-group',
  templateUrl: './user-group.component.html',
  styleUrls: ['./user-group.component.scss'],
})
export class UserGroupComponent implements OnChanges {
  @Input({ required: true }) public patron!: CardPatron;
  @Input() public disabled = false;
  public groups: readonly EligibleUserGroup[] = [];
  public selectedCode: string | null = null;
  public loading = false;
  public saving = false;
  public error = '';
  public readonly activity = inject(MutationActivityService);
  private readonly api = inject(PatronApiService);
  private readonly errors = inject(CardErrorService);
  private readonly state = inject(PatronStateService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly feedback = inject(MutationFeedbackService);
  private readonly destroyRef = inject(DestroyRef);
  private context: PatronMutationContext | null = null;
  private confirmedCode: string | null = null;
  private loadVersion = 0;

  public constructor() {
    this.activity.eligibilityRefresh$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadGroups());
  }

  public get selectedGroup(): EligibleUserGroup | undefined {
    return this.groups.find((group) => group.code === this.selectedCode);
  }

  public get onlyCurrentGroupAvailable(): boolean {
    return (
      !this.loading &&
      !this.error &&
      this.groups.length === 1 &&
      this.groups[0].code === this.patron.currentUserGroupCode
    );
  }

  public get groupDescription(): string | null {
    const group =
      this.selectedGroup ||
      (this.groups.length === 1 ? this.groups[0] : undefined);
    const description = group?.description.trim();

    return description && description !== group?.displayName.trim()
      ? description
      : null;
  }

  public get canSave(): boolean {
    return (
      !this.disabled &&
      !this.activity.busy &&
      !this.loading &&
      !this.saving &&
      !this.error &&
      !!this.selectedGroup &&
      this.selectedCode !== this.patron.currentUserGroupCode
    );
  }

  public ngOnChanges(): void {
    const context = this.state.currentMutationContext();
    const changedSelection = context !== this.context;

    if (changedSelection || this.selectedCode === this.confirmedCode) {
      this.selectedCode = this.patron.currentUserGroupCode;
    }
    this.confirmedCode = this.patron.currentUserGroupCode;
    this.context = context;

    if (changedSelection) {
      this.loadGroups();
    }
  }

  public loadGroups(): void {
    const context = this.state.currentMutationContext();
    const version = ++this.loadVersion;

    this.groups = [];
    this.error = '';

    if (!context) {
      return;
    }
    this.loading = true;
    this.api
      .getEligibleUserGroups(context.patronId)
      .pipe(
        finalize(() => {
          if (version === this.loadVersion) {
            this.loading = false;
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (
            this.state.currentMutationContext() === context &&
            version === this.loadVersion
          ) {
            this.groups = result.eligibleGroups;
          }
        },
        error: (error: unknown) => {
          if (
            this.state.currentMutationContext() === context &&
            version === this.loadVersion
          ) {
            const apiError = normalizeCardError(error);

            this.error = this.errors.message(apiError);
          }
        },
      });
  }

  public trackGroup(_index: number, group: EligibleUserGroup): string {
    return group.code;
  }

  public save(): void {
    const context = this.state.currentMutationContext();
    const groupCode = this.selectedCode;

    if (!this.canSave || !context || !groupCode) {
      return;
    }
    this.dialog
      .open(ConfirmationdialogComponent, {
        data: { confirmMessage: this.translate.instant('UserGroup.Confirm') },
      })
      .afterClosed()
      .pipe(
        filter((confirmed): confirmed is true => confirmed === true),
        switchMap(() => {
          if (
            !this.canSave ||
            this.state.currentMutationContext() !== context ||
            this.selectedCode !== groupCode
          ) {
            return EMPTY;
          }
          this.saving = true;

          return this.api.setUserGroup(context.patronId, groupCode).pipe(
            filter(() => this.state.currentMutationContext() === context),
            tap((patron) => {
              this.selectedCode = patron.currentUserGroupCode;
              this.state.replacePatron(patron, context);
            }),
            catchError((error: unknown) => {
              if (this.state.currentMutationContext() !== context) {
                return EMPTY;
              }

              if (
                normalizeCardError(error).type === 'USER_GROUP_NOT_ELIGIBLE'
              ) {
                this.loadGroups();
              }

              return throwError(() => error);
            }),
            this.feedback.handle('UserGroup.Success'),
            finalize(() => {
              this.saving = false;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
