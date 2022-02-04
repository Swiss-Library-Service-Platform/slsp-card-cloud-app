import { NgModule } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule, CloudAppTranslateModule, AlertModule } from '@exlibris/exl-cloudapp-angular-lib';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { MainComponent } from './main/main.component';
import { BlockComponent } from './block/block.component';
import { SettingsComponent } from './settings/settings.component';
import { LibrarycardnumberComponent } from './librarycardnumber/librarycardnumber.component';
import { UsermenuComponent } from './usermenu/usermenu.component';
import { APIInterceptor } from './services/api-interceptor';
import { ConfirmationdialogComponent } from './confirmationdialog/confirmationdialog.component';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    BlockComponent,
    SettingsComponent,
    LibrarycardnumberComponent,
    UsermenuComponent,
    ConfirmationdialogComponent,
  ],
  imports: [
    MaterialModule,
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    AlertModule,
    FormsModule,
    ReactiveFormsModule,
    CloudAppTranslateModule.forRoot(),
  ],
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'standard'
      },
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: APIInterceptor,
      multi: true,
    }
  ],
  entryComponents: [ConfirmationdialogComponent],
  bootstrap: [AppComponent]
})
export class AppModule { }
