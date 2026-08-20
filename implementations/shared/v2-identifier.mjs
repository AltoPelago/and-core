export const ND_V2_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function isNdV2Identifier(value) {
  return typeof value === 'string' && ND_V2_IDENTIFIER_PATTERN.test(value);
}
