import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CardPatron } from '../models/card-api.model';

@Component({
  selector: 'app-invoice-contacts',
  templateUrl: './invoice-contacts.component.html',
  styleUrls: ['./invoice-contacts.component.scss'],
})
export class InvoiceContactsComponent {
  @Input({ required: true }) public patron!: CardPatron;
  @Input() public disabled = false;
  @Output() public readonly busyChange = new EventEmitter<boolean>();
}
