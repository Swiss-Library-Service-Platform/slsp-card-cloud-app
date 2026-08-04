import {
  AddBlockRequest,
  AddLibraryCardNumberRequest,
  CardApiError,
  CardErrorType,
  CardPatron,
  SetPreferredAddressRequest,
} from './card-api.model';

describe('Card API models', () => {
  const patron: CardPatron = {
    fullName: 'Test Patron',
    external: true,
    libraryCardNumbers: [
      {
        value: 'abc',
        alias: false,
        removable: true,
        selector: 'opaque-card-selector',
      },
      {
        value: 'imported',
        alias: false,
        removable: false,
        selector: null,
      },
    ],
    matriculationNumber: '12345678',
    dashedMatriculationNumber: '12-345-678',
    blocks: {
      '03.1': {
        code: '03.1',
        createdDate: null,
        expiryDate: null,
        note: '',
        selector: 'opaque-block-selector',
      },
    },
    postalAddresses: [
      {
        selector: null,
        types: [],
        line1: null,
        postalCode: null,
        city: null,
        country: null,
        preferred: false,
      },
    ],
  };
  const errorTypes: Readonly<Record<CardErrorType, true>> = {
    AUTHENTICATION_FAILED: true,
    ACCESS_DENIED: true,
    INVALID_PATRON_ID: true,
    PATRON_NOT_FOUND: true,
    INVALID_LIBRARY_CARD_FORMAT: true,
    DUPLICATE_LIBRARY_CARD_NUMBER: true,
    UNSUPPORTED_BLOCK: true,
    BLOCK_COMMENT_REQUIRED: true,
    STALE_SELECTION: true,
    INVALID_SETTINGS_NOTE: true,
    UPSTREAM_FAILURE: true,
    DEPENDENCY_UNAVAILABLE: true,
    UNEXPECTED_FAILURE: true,
  };

  it('represents only the backend Card patron contract', () => {
    expect(patron.fullName).toBe('Test Patron');
    expect(patron.libraryCardNumbers[1].selector).toBeNull();
    expect(patron.postalAddresses[0].selector).toBeNull();
    expect('contact_info' in patron).toBeFalse();
  });

  it('represents all stable backend error types and safe error fields', () => {
    const error: CardApiError = {
      type: 'STALE_SELECTION',
      errorId: 'error-id',
      context: { operation: 'card_remove' },
    };

    expect(Reflect.ownKeys(errorTypes)).toHaveSize(13);
    expect(error).toEqual({
      type: 'STALE_SELECTION',
      errorId: 'error-id',
      context: { operation: 'card_remove' },
    });
  });

  it('represents the three backend mutation request bodies', () => {
    const addCard: AddLibraryCardNumberRequest = { value: 'SLSP-123456789' };
    const addBlock: AddBlockRequest = { code: '09', comment: 'comment' };
    const preferredAddress: SetPreferredAddressRequest = {
      selector: 'opaque-address-selector',
    };

    expect([addCard, addBlock, preferredAddress]).toEqual([
      { value: 'SLSP-123456789' },
      { code: '09', comment: 'comment' },
      { selector: 'opaque-address-selector' },
    ]);
  });
});
