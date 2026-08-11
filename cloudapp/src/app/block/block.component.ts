import { DestroyRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { Observable, finalize, map, tap } from 'rxjs';

import {
  AddableBlockCode,
  BlockView,
  CardPatron,
} from '../models/card-api.model';
import { MutationFeedbackService } from '../services/mutation-feedback.service';
import { PatronApiService } from '../services/patron-api.service';
import { PatronStateService } from '../services/patron-state.service';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['block.component.scss'],
})
export class BlockComponent {
  public readonly patron$: Observable<CardPatron | null>;
  public commentDouble = '';
  public commentGlobal = '';
  public commentWrongEmail = '';
  public commentWrongPostal = '';
  public loading = false;

  private readonly api = inject(PatronApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly feedback = inject(MutationFeedbackService);
  private readonly state = inject(PatronStateService);
  private readonly translate = inject(TranslateService);

  public constructor() {
    this.patron$ = this.state.patronState$.pipe(
      map((patronState) =>
        patronState.status === 'ready' ? patronState.patron : null,
      ),
    );
  }

  public add(code: AddableBlockCode, comment: string): void {
    const trimmedComment = comment.trim();
    const mutationContext = this.state.currentMutationContext();

    if (
      this.loading ||
      !mutationContext ||
      (code === '09' && trimmedComment === '')
    ) {
      return;
    }

    this.loading = true;
    this.api
      .addBlock(mutationContext.patronId, code, trimmedComment)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
        }),
        this.feedback.handle('Blocks.AddSuccess'),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public getDateString(date: string | null): string {
    if (!date) {
      return '';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat(this.translate.currentLang || 'en', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    }).format(parsedDate);
  }

  public hasBlocks(blocks: CardPatron['blocks']): boolean {
    return !!(
      blocks['02'] ||
      blocks['03'] ||
      blocks['03.1'] ||
      blocks['09'] ||
      blocks['08']
    );
  }

  public remove(block: BlockView): void {
    const mutationContext = this.state.currentMutationContext();

    if (this.loading || !mutationContext) {
      return;
    }

    this.loading = true;
    this.api
      .removeBlock(mutationContext.patronId, block.elementReference)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
        }),
        this.feedback.handle('Blocks.RemoveSuccess'),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
