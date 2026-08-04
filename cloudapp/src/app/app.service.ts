import { inject, Injectable } from '@angular/core';
import { InitService } from '@exlibris/exl-cloudapp-angular-lib';

@Injectable({
  providedIn: 'root',
})
export class AppService {
  private readonly initService: InitService = inject(InitService);
}
