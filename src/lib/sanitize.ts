const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

/**
 * Normalises a user-provided display name: strips control/bidi characters,
 * collapses whitespace and limits length. React escapes output anyway; this
 * keeps stored data tidy and prevents layout-breaking input.
 */
export function sanitizeName(input: string, maxLength = 16): string {
  return input
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Search queries: plain text only, bounded length, lowercase. */
export function normalizeQuery(input: string): string {
  return input.replace(CONTROL_CHARS, '').trim().toLowerCase().slice(0, 60);
}
