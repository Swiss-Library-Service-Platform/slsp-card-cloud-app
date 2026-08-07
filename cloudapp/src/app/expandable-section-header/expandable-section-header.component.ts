import { Component, Input } from '@angular/core';

export type SectionStatusVariant = 'neutral' | 'danger';

let nextPanelId = 0;

@Component({
  selector: 'app-expandable-section-header',
  templateUrl: './expandable-section-header.component.html',
  styleUrls: ['./expandable-section-header.component.scss'],
})
export class ExpandableSectionHeaderComponent {
  @Input({ required: true }) public title = '';
  @Input({ required: true }) public infoLabel = '';
  @Input() public status: string | null = null;
  @Input() public statusVariant: SectionStatusVariant = 'neutral';

  public expanded = false;
  public readonly panelId = `slsp-section-information-${nextPanelId++}`;

  public toggle(): void {
    this.expanded = !this.expanded;
  }
}
