import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { filter, take } from 'rxjs';

import { ConfirmationdialogComponent } from '../confirmationdialog/confirmationdialog.component';
import { MutationActivityService } from '../services/mutation-activity.service';
import { PatronStateService } from '../services/patron-state.service';
import { EduIdSyncService } from './edu-id-sync.service';

@Component({
  selector: 'app-edu-id-sync',
  templateUrl: './edu-id-sync.component.html',
})
export class EduIdSyncComponent {
  public readonly activity = inject(MutationActivityService);
  private readonly syncService = inject(EduIdSyncService);
  private readonly state = inject(PatronStateService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  public get loading(): boolean {
    return this.syncService.loading;
  }
  public get supported(): boolean {
    return this.syncService.supported;
  }
  public get needsRefresh(): boolean {
    return this.syncService.needsRefresh;
  }

  public sync(): void {
    const context = this.state.currentMutationContext();

    if (
      !context ||
      !this.supported ||
      this.loading ||
      this.activity.busy ||
      this.needsRefresh
    ) {
      return;
    }
    this.dialog
      .open(ConfirmationdialogComponent, {
        data: { confirmMessage: this.translate.instant('EduIdSync.Confirm') },
      })
      .afterClosed()
      .pipe(
        take(1),
        filter((confirmed) => confirmed === true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncService.sync(context));
  }

  public refresh(): void {
    this.syncService.refresh();
  }
}
