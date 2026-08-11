import { Component, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { CardPatron } from '../models/card-api.model';
import { PatronStateService } from '../services/patron-state.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  public readonly patron$: Observable<CardPatron | null>;
  public mutationBusy = false;

  private readonly state = inject(PatronStateService);

  public constructor() {
    this.patron$ = this.state.patronState$.pipe(
      map((patronState) =>
        patronState.status === 'ready' ? patronState.patron : null,
      ),
    );
  }

  public setMutationBusy(busy: boolean): void {
    this.mutationBusy = busy;
  }
}
