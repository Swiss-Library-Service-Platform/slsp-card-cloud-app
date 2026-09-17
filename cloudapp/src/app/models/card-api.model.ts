export type BlockCode = '02' | '03' | '03.1' | '09' | '08';

export type AddableBlockCode = Exclude<BlockCode, '08'>;

export interface LibraryCardNumberView {
  readonly value: string | null;
  readonly alias: boolean;
  readonly removable: boolean;
  readonly elementReference: string | null;
}

export interface BlockView {
  readonly code: BlockCode;
  readonly createdDate: string | null;
  readonly expiryDate: string | null;
  readonly note: string | null;
  readonly elementReference: string;
}

export interface PostalAddressView {
  readonly elementReference: string | null;
  readonly types: readonly string[];
  readonly line1: string | null;
  readonly postalCode: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly preferred: boolean;
}

export interface InvoicePostalAddressView {
  readonly elementReference: string;
  readonly line1: string | null;
  readonly line2: string | null;
  readonly line3: string | null;
  readonly line4: string | null;
  readonly postalCode: string | null;
  readonly city: string | null;
  readonly countryCode: string | null;
}

export interface InvoiceEmailAddressView {
  readonly elementReference: string;
  readonly emailAddress: string | null;
}

export interface EligibleUserGroup {
  readonly code: string;
  readonly displayName: string;
  readonly description: string;
}

export interface EligibleUserGroups {
  readonly eligibleGroups: readonly EligibleUserGroup[];
}

export interface CardPatron {
  readonly currentUserGroupCode: string | null;
  readonly currentUserGroupDescription: string | null;
  readonly fullName: string | null;
  readonly external: boolean;
  readonly libraryCardNumbers: readonly LibraryCardNumberView[];
  readonly matriculationNumber: string | null;
  readonly dashedMatriculationNumber: string | null;
  readonly blocks: Readonly<Partial<Record<BlockCode, BlockView>>>;
  readonly postalAddresses: readonly PostalAddressView[];
  readonly preferredEmailAddress: string | null;
  readonly invoicePostalAddress: InvoicePostalAddressView | null;
  readonly invoiceEmailAddress: InvoiceEmailAddressView | null;
}

export interface AddLibraryCardNumberRequest {
  readonly value: string;
}

export interface AddBlockRequest {
  readonly code: AddableBlockCode;
  readonly comment: string;
}

export interface SetPreferredAddressRequest {
  readonly elementReference: string;
}

export interface SetInvoicePostalAddressRequest {
  readonly elementReference: string | null;
  readonly line1: string;
  readonly line2: string | null;
  readonly line3: string | null;
  readonly line4: string | null;
  readonly postalCode: string;
  readonly city: string;
  readonly countryCode: string;
}

export interface SetInvoiceEmailAddressRequest {
  readonly elementReference: string | null;
  readonly emailAddress: string;
}

export type CardErrorType =
  | 'INVALID_USER_GROUP'
  | 'USER_GROUP_NOT_ELIGIBLE'
  | 'EDU_ID_SYNC_NOT_SUPPORTED'
  | 'SYNC_OUTCOME_UNKNOWN'
  | 'SYNC_REFRESH_FAILED'
  | 'SYNC_PATRON_UNAVAILABLE'
  | 'AUTHENTICATION_FAILED'
  | 'ACCESS_DENIED'
  | 'INVALID_PATRON_ID'
  | 'PATRON_NOT_FOUND'
  | 'INVALID_LIBRARY_CARD_FORMAT'
  | 'DUPLICATE_LIBRARY_CARD_NUMBER'
  | 'UNSUPPORTED_BLOCK'
  | 'BLOCK_COMMENT_REQUIRED'
  | 'STALE_ELEMENT_REFERENCE'
  | 'INVALID_SETTINGS_NOTE'
  | 'INVALID_INVOICE_POSTAL_ADDRESS'
  | 'INVALID_INVOICE_EMAIL_ADDRESS'
  | 'ALMA_REQUEST_REJECTED'
  | 'REGISTRATION_PLATFORM_FAILURE'
  | 'REGISTRATION_PLATFORM_UNAVAILABLE'
  | 'ALMA_FAILURE'
  | 'ALMA_UNAVAILABLE'
  | 'UNEXPECTED_FAILURE'
  // Client-only fallbacks when no valid typed backend response is available.
  | 'UPSTREAM_FAILURE'
  | 'DEPENDENCY_UNAVAILABLE';

export interface CardApiError {
  readonly type: CardErrorType;
  readonly errorId: string;
  readonly messages: readonly string[];
}
