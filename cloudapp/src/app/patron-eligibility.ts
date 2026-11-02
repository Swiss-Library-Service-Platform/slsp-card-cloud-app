export const EDITABLE_PATRON_ID_SUFFIXES = [
  '@eduid.ch',
  '@test.eduid.ch',
] as const;

export const EDITABLE_PATRON_ID_PREFIXES = [
  'SLIB_',
  'ORG_',
  'NPO_',
  'VAT_FREE_ORG_',
  'VAT_FREE_NPO_',
] as const;

export type PatronAccountType = 'eduId' | 'institutional' | 'unsupported';

export function getPatronAccountType(
  primaryId: string | null,
): PatronAccountType {
  if (!primaryId) {
    return 'unsupported';
  }

  if (
    EDITABLE_PATRON_ID_SUFFIXES.some((suffix) =>
      primaryId.toLowerCase().endsWith(suffix),
    )
  ) {
    return 'eduId';
  }

  if (
    EDITABLE_PATRON_ID_PREFIXES.some((prefix) => primaryId.startsWith(prefix))
  ) {
    return 'institutional';
  }

  return 'unsupported';
}

export function isEditablePatronId(primaryId: string | null): boolean {
  return getPatronAccountType(primaryId) !== 'unsupported';
}
