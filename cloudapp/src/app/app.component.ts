import { Component, inject } from '@angular/core';
import { AppService } from './app.service';

@Component({
  selector: 'app-root',
  template: '<cloudapp-alert></cloudapp-alert><router-outlet></router-outlet>',
})
export class AppComponent {
  private readonly appService: AppService = inject(AppService);
}
