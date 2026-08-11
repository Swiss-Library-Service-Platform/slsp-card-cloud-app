import { Entity, EntityType } from '@exlibris/exl-cloudapp-angular-lib';

import { extractPatronId } from './services/patron-state.service';
import {
  EDITABLE_PATRON_ID_PREFIXES,
  isEditablePatronId,
} from './patron-eligibility';

describe('patron eligibility', () => {
  it('accepts production and test edu-ID accounts case-insensitively', () => {
    expect(isEditablePatronId('patron@eduid.ch')).toBeTrue();
    expect(isEditablePatronId('patron@test.eduid.ch')).toBeTrue();
    expect(isEditablePatronId('patron@EDUID.CH')).toBeTrue();
    expect(isEditablePatronId('patron@TEST.EDUID.CH')).toBeTrue();
  });

  EDITABLE_PATRON_ID_PREFIXES.forEach((prefix) => {
    it(`accepts an account beginning with ${prefix}`, () => {
      expect(isEditablePatronId(`${prefix}12345`)).toBeTrue();
    });

    it(`rejects a differently cased ${prefix} prefix`, () => {
      expect(isEditablePatronId(`${prefix.toLowerCase()}12345`)).toBeFalse();
    });
  });

  [
    null,
    '',
    'staff-user',
    'patron@other-eduid.ch',
    'patron@eduid.ch.example',
    'prefix_ORG_12345',
  ].forEach((primaryId) => {
    it(`rejects ineligible primary ID ${String(primaryId)}`, () => {
      expect(isEditablePatronId(primaryId)).toBeFalse();
    });
  });

  it('rejects an entity whose link does not contain a valid primary ID', () => {
    const malformed: Entity = {
      id: 'entity-metadata',
      type: EntityType.USER,
      link: '/users/staff-user?expand=full',
      description: 'Staff user',
    };

    expect(isEditablePatronId(extractPatronId(malformed))).toBeFalse();
  });
});
