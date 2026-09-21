import { Component, Input } from '@angular/core';

import { CardPatron } from '../models/card-api.model';

@Component({
  selector: 'app-invoice-contacts',
  templateUrl: './invoice-contacts.component.html',
  styleUrls: ['./invoice-contacts.component.scss'],
})
export class InvoiceContactsComponent {
  @Input({ required: true }) public patron!: CardPatron;
}
