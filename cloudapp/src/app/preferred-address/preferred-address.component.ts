import { Component, DestroyRef, Input, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';

import { CardPatron, PostalAddressView } from '../models/card-api.model';
import { MutationFeedbackService } from '../services/mutation-feedback.service';
import { PatronApiService } from '../services/patron-api.service';
import { PatronStateService } from '../services/patron-state.service';

@Component({
  selector: 'app-preferred-address',
  templateUrl: './preferred-address.component.html',
  styleUrls: ['./preferred-address.component.scss'],
})
export class PreferredAddressComponent {
  @Input({ required: true }) public patron!: CardPatron;

  public loading = false;

  private readonly api = inject(PatronApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly feedback = inject(MutationFeedbackService);
  private readonly state = inject(PatronStateService);

  public changePreferredAddress(address: PostalAddressView): void {
    const mutationContext = this.state.currentMutationContext();

    if (
      this.loading ||
      address.preferred ||
      !address.elementReference ||
      !mutationContext
    ) {
      return;
    }

    this.loading = true;
    this.api
      .setPreferredAddress(mutationContext.patronId, address.elementReference)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
        }),
        this.feedback.handle('Settings.SetSuccess'),
        finalize(() => {
          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public trackAddress(index: number, address: PostalAddressView): string {
    return address.elementReference ?? `${index}:${address.types.join(',')}`;
  }
}
