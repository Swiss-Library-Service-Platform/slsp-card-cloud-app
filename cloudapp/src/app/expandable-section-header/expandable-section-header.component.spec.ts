import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MaterialModule } from '@exlibris/exl-cloudapp-angular-lib';

import { ExpandableSectionHeaderComponent } from './expandable-section-header.component';

@Component({
  template: `
    <div class="mat-typography">
      <app-expandable-section-header
        [title]="title"
        [infoLabel]="infoLabel"
        [status]="status"
        statusVariant="danger"
      >
        <p><a href="https://example.com">Projected information</a></p>
      </app-expandable-section-header>
    </div>
  `,
})
class TestHostComponent {
  public title = 'Example section';
  public infoLabel: string | null = 'More information';
  public status: string | null = 'Active';
}

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
    expect(button.textContent).toContain('info_outline');
  });

  it('expands projected information only from the shared info button', () => {
    const component = fixture.debugElement.query(
      By.directive(ExpandableSectionHeaderComponent),
    ).componentInstance as ExpandableSectionHeaderComponent;
    const button = fixture.nativeElement.querySelector(
      '[data-info]',
    ) as HTMLButtonElement;
    const header = fixture.nativeElement.querySelector(
      '.slsp-section__header',
    ) as HTMLElement;

    header.click();
    fixture.detectChanges();

    expect(component.expanded).toBeFalse();

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

  it('renders a title-only header without help controls or a hidden panel', () => {
    fixture.componentInstance.infoLabel = null;
    fixture.componentInstance.status = null;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-info]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.expandable-information'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.slsp-section__title').textContent,
    ).toContain('Example section');
  });

  it('renders an optional status independently of help', () => {
    fixture.componentInstance.infoLabel = null;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-info]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.slsp-status--danger').textContent,
    ).toContain('Active');
  });

  it('protects centered section-title geometry from Material typography', () => {
    const header = fixture.nativeElement.querySelector(
      '.slsp-section__header',
    ) as HTMLElement;
    const title = fixture.nativeElement.querySelector(
      '.slsp-section__title',
    ) as HTMLElement;
    const headerStyle = getComputedStyle(header);
    const titleStyle = getComputedStyle(title);

    expect(headerStyle.alignItems).toBe('center');
    expect(headerStyle.minHeight).toBe('56px');
    expect(headerStyle.paddingTop).toBe('12px');
    expect(headerStyle.paddingRight).toBe('16px');
    expect(headerStyle.paddingBottom).toBe('12px');
    expect(headerStyle.paddingLeft).toBe('16px');
    expect(titleStyle.marginBottom).toBe('0px');
    expect(titleStyle.fontWeight).toBe('400');
  });
});
