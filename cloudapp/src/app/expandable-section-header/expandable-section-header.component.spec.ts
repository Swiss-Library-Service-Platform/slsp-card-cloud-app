import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MaterialModule } from '@exlibris/exl-cloudapp-angular-lib';

import { ExpandableSectionHeaderComponent } from './expandable-section-header.component';

@Component({
  template: `
    <app-expandable-section-header
      title="Example section"
      infoLabel="More information"
      status="Active"
      statusVariant="danger"
    >
      <p><a href="https://example.com">Projected information</a></p>
    </app-expandable-section-header>
  `,
})
class TestHostComponent {}

describe('ExpandableSectionHeaderComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExpandableSectionHeaderComponent, TestHostComponent],
      imports: [MaterialModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('starts collapsed with an inaccessible information panel', () => {
    const button = fixture.nativeElement.querySelector(
      '[data-info]',
    ) as HTMLButtonElement;
    const panel = fixture.nativeElement.querySelector(
      '.expandable-information',
    ) as HTMLElement;

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(panel.hasAttribute('inert')).toBeTrue();
    expect(panel.classList).not.toContain('expandable-information--expanded');
    expect(
      fixture.nativeElement.querySelector('.slsp-status--danger').textContent,
    ).toContain('Active');
  });

  it('expands projected information from the shared info button', () => {
    const component = fixture.debugElement.query(
      By.directive(ExpandableSectionHeaderComponent),
    ).componentInstance as ExpandableSectionHeaderComponent;
    const button = fixture.nativeElement.querySelector(
      '[data-info]',
    ) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector(
      '.expandable-information',
    ) as HTMLElement;

    expect(component.expanded).toBeTrue();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.classList).toContain('info-button--expanded');
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(panel.hasAttribute('inert')).toBeFalse();
    expect(panel.classList).toContain('expandable-information--expanded');
    expect(panel.textContent).toContain('Projected information');
  });
});
