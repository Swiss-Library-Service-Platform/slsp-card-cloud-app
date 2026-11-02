import { Component, inject } from '@angular/core';
import { AppService } from './app.service';

@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {
  private readonly appService: AppService = inject(AppService);
}
