import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AppComponent } from './app.component';
import { AppService } from './app.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [{ provide: AppService, useValue: {} }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('creates under the Angular 18 TestBed', () => {
    const fixture = TestBed.createComponent(AppComponent);

    expect(fixture.componentInstance).toBeTruthy();
  });
});
