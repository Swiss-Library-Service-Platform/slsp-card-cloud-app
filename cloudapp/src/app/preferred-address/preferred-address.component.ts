import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
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
  @Input() public disabled = false;
  @Output() public readonly busyChange = new EventEmitter<boolean>();

  public loading = false;

  private readonly api = inject(PatronApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly feedback = inject(MutationFeedbackService);
  private readonly state = inject(PatronStateService);

  public changePreferredAddress(address: PostalAddressView): void {
    const mutationContext = this.state.currentMutationContext();

    if (
      this.disabled ||
      this.loading ||
      address.preferred ||
      !address.elementReference ||
      !mutationContext
    ) {
      return;
    }

    this.setBusy(true);
    this.api
      .setPreferredAddress(mutationContext.patronId, address.elementReference)
      .pipe(
        tap((patron) => {
          this.state.replacePatron(patron, mutationContext);
        }),
        this.feedback.handle('Settings.SetSuccess'),
        finalize(() => this.setBusy(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public trackAddress(index: number, address: PostalAddressView): string {
    return address.elementReference ?? `${index}:${address.types.join(',')}`;
  }

  private setBusy(value: boolean): void {
    this.loading = value;
    this.busyChange.emit(value);
  }
}
