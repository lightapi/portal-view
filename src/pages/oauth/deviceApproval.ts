/** Helpers for the CLI sign-in approval page (RFC 8628 device grant). */

/** Letters the server uses for user codes: no vowels, no look-alikes. */
const USER_CODE_PATTERN = /^[BCDFGHJKLMNPQRSTVWXZ]{8}$/;

/**
 * The provider id from the link the CLI printed (`?provider=`). It becomes a path segment of the
 * API call, so anything but a plain identifier is refused: `..` or a slash would change which
 * route the request reaches.
 */
export function providerFromLink(value: string | null | undefined): string | null {
  const id = (value ?? '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

/** Normalise what a person typed or pasted (`bcdf-ghjk`, ` BCDF GHJK `); null if it cannot be a code. */
export function normalizeUserCode(input: string | null | undefined): string | null {
  const code = (input ?? '').replace(/[\s-]/g, '').toUpperCase();
  return USER_CODE_PATTERN.test(code) ? code : null;
}

/** `BCDFGHJK` -> `BCDF-GHJK` */
export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** A length of time in the words a person would use: "1 day", "90 days", "2 hours", "5 minutes". */
export function formatDuration(seconds: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (seconds >= 86_400 && seconds % 86_400 === 0) return plural(seconds / 86_400, 'day');
  if (seconds >= 86_400) return plural(Math.round(seconds / 86_400), 'day');
  if (seconds >= 3_600) return plural(Math.round(seconds / 3_600), 'hour');
  return plural(Math.max(1, Math.round(seconds / 60)), 'minute');
}

/** What `fetchClient` throws is a parsed body, a string, or an Error: make it text a person can read. */
export function describeError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const body = error as { message?: unknown; status?: unknown; error?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (typeof body.status === 'string') return body.status;
    if (typeof body.error === 'string') return body.error;
  }
  return 'Something went wrong.';
}

/** Did the server refuse because nobody is signed in? `fetchClient` puts the HTTP status in the message. */
export function isUnauthorized(error: unknown): boolean {
  if (error && typeof error === 'object' && (error as { statusCode?: unknown }).statusCode === 401) return true;
  return /\bHTTP 401\b/.test(describeError(error));
}

export type FailedDecision = 'expired' | 'forbidden' | 'not_found';

/**
 * Why an approve or deny was refused, if it was one of the refusals the server describes.
 *
 * light-oauth answers those with a JSON body (`{"status":"expired"}` for HTTP 410, `forbidden` for 403,
 * `not_found` for 404), and `fetchClient` throws a JSON body as the parsed object, not as text with the
 * HTTP status in it. A refusal that arrives as plain text (from the Gateway, say) carries the status in
 * the text instead, so both are read.
 */
export function failedDecision(error: unknown): FailedDecision | null {
  if (error && typeof error === 'object' && !(error instanceof Error)) {
    const status = (error as { status?: unknown }).status;
    if (status === 'expired' || status === 'forbidden' || status === 'not_found') return status;
  }
  const text = describeError(error);
  if (/\bHTTP 410\b/.test(text)) return 'expired';
  if (/\bHTTP 403\b/.test(text)) return 'forbidden';
  if (/\bHTTP 404\b/.test(text)) return 'not_found';
  return null;
}

/** The server's reply to an approval, as a sentence. */
export function approvalOutcome(status: string, lifetimeSeconds?: number): { severity: 'success' | 'info' | 'error'; text: string } {
  switch (status) {
    case 'approved':
      return {
        severity: 'success',
        text: `Approved. The device is signed in for ${formatDuration(lifetimeSeconds ?? 0)}. You can close this page and go back to your terminal.`,
      };
    case 'denied':
      return { severity: 'info', text: 'Denied. The device will not be signed in.' };
    case 'expired':
      return { severity: 'error', text: 'That code has expired. Start again with `/login`.' };
    case 'forbidden':
      return { severity: 'error', text: 'Your account may not sign in this device.' };
    default:
      return { severity: 'error', text: 'That code is not valid, or it was already used. Start again with `/login`.' };
  }
}
