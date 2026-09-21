import { describe, expect, it } from 'vitest';
import {
  approvalOutcome,
  describeError,
  failedDecision,
  formatDuration,
  formatUserCode,
  isUnauthorized,
  normalizeUserCode,
  providerFromLink,
} from './deviceApproval';

describe('normalizeUserCode', () => {
  it.each([
    ['BCDFGHJK', 'BCDFGHJK'],
    ['bcdf-ghjk', 'BCDFGHJK'],
    [' BCDF GHJK ', 'BCDFGHJK'],
  ])('accepts %j', (typed, expected) => expect(normalizeUserCode(typed)).toBe(expected));

  it.each(['', 'BCDFGHJ', 'BCDFGHJKL', 'BCDFGHJA', 'BCDF-GHJ1', 'bcdf/ghjk', null, undefined])(
    'rejects %j',
    (typed) => expect(normalizeUserCode(typed)).toBeNull(),
  );

  it('formats a code for display', () => expect(formatUserCode('BCDFGHJK')).toBe('BCDF-GHJK'));
});

describe('formatDuration', () => {
  it.each([
    [86_400, '1 day'],
    [7_776_000, '90 days'],
    [259_200, '3 days'],
    [7_200, '2 hours'],
    [3_600, '1 hour'],
    [300, '5 minutes'],
    [60, '1 minute'],
    [10, '1 minute'],
    [0, '1 minute'],
  ])('%d seconds is %s', (seconds, text) => expect(formatDuration(seconds)).toBe(text));
});

describe('errors', () => {
  it('reads the text of whatever fetchClient threw', () => {
    expect(describeError('HTTP 404: nope')).toBe('HTTP 404: nope');
    expect(describeError(new Error('boom'))).toBe('boom');
    expect(describeError({ message: 'from the body' })).toBe('from the body');
    expect(describeError({ status: 'not_found' })).toBe('not_found');
    expect(describeError(undefined)).toBe('Something went wrong.');
  });

  it('recognises "not signed in" only for a 401', () => {
    expect(isUnauthorized('HTTP 401 Unauthorized: invalid bearer token')).toBe(true);
    expect(isUnauthorized('HTTP 403 Forbidden')).toBe(false);
    expect(isUnauthorized('HTTP 4010')).toBe(false);
    expect(isUnauthorized(undefined)).toBe(false);
    expect(isUnauthorized({ statusCode: 401, message: 'no token' })).toBe(true);
    expect(isUnauthorized({ statusCode: 403 })).toBe(false);
  });
});

describe('failedDecision', () => {
  it('reads the JSON bodies light-oauth answers with, which fetchClient throws as parsed objects', () => {
    expect(failedDecision({ status: 'expired' })).toBe('expired');
    expect(failedDecision({ status: 'forbidden' })).toBe('forbidden');
    expect(failedDecision({ status: 'not_found' })).toBe('not_found');
  });

  it('reads a refusal that arrived as text with the HTTP status in it', () => {
    expect(failedDecision('HTTP 410 Gone')).toBe('expired');
    expect(failedDecision('HTTP 403 Forbidden: nope')).toBe('forbidden');
    expect(failedDecision('HTTP 404 Not Found: that code is not valid or has expired')).toBe('not_found');
  });

  it('leaves everything else to be shown as it is', () => {
    expect(failedDecision({ status: 'approved' })).toBeNull();
    expect(failedDecision({ status: 'weird' })).toBeNull();
    expect(failedDecision('HTTP 500 Internal Server Error')).toBeNull();
    expect(failedDecision(new Error('boom'))).toBeNull();
    expect(failedDecision(undefined)).toBeNull();
    expect(failedDecision('HTTP 4100')).toBeNull();
  });
});

describe('approvalOutcome', () => {
  it('says how long an approved device stays signed in', () => {
    const outcome = approvalOutcome('approved', 7_776_000);
    expect(outcome.severity).toBe('success');
    expect(outcome.text).toContain('90 days');
  });

  it.each([
    ['denied', 'info', 'Denied'],
    ['expired', 'error', 'expired'],
    ['forbidden', 'error', 'may not'],
    ['not_found', 'error', 'not valid'],
    ['anything else', 'error', 'not valid'],
  ])('%s', (status, severity, text) => {
    const outcome = approvalOutcome(status);
    expect(outcome.severity).toBe(severity);
    expect(outcome.text).toContain(text);
  });
});

describe('providerFromLink', () => {
  it.each(['AZZRJE52eXu3t1hseacnGQ', 'tenant-2_x', ' prov '])('accepts %j', (id) =>
    expect(providerFromLink(id)).toBe(id.trim()));

  it.each(['', '  ', '..', '../x', 'a/b', 'a b', 'a.b', 'a%2Fb', 'x'.repeat(65), null, undefined])('refuses %j', (id) =>
    expect(providerFromLink(id)).toBeNull());
});
