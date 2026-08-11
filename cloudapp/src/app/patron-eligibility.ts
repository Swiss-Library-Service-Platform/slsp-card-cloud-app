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

export function isEditablePatronId(primaryId: string | null): boolean {
  if (!primaryId) {
    return false;
  }

  const normalizedId = primaryId.toLowerCase();

  return (
    EDITABLE_PATRON_ID_SUFFIXES.some((suffix) =>
      normalizedId.endsWith(suffix),
    ) ||
    EDITABLE_PATRON_ID_PREFIXES.some((prefix) => primaryId.startsWith(prefix))
  );
}
