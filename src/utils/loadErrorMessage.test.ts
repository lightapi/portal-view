import { describe, expect, it } from 'vitest';
import { loadErrorMessage } from './loadErrorMessage';

describe('loadErrorMessage', () => {
  it('preserves a gateway access-control response', () => {
    expect(loadErrorMessage(
      'HTTP 403 Forbidden: Access denied by access control rule for lightapi.net/product/getProductVersion/0.1.0',
    )).toBe(
      'HTTP 403 Forbidden: Access denied by access control rule for lightapi.net/product/getProductVersion/0.1.0',
    );
  });

  it('extracts nested JSON-RPC descriptions', () => {
    expect(loadErrorMessage({ error: { data: { description: 'Required role is missing' } } }))
      .toBe('Required role is missing');
  });

  it('returns a stable message for an empty response', () => {
    expect(loadErrorMessage({})).toBe('The request failed without an error message.');
  });
});
