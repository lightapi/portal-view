import { describe, expect, it } from 'vitest';
import { llmErrorMessage } from './error';

describe('llmErrorMessage', () => {
  it('shows nested JSON-RPC descriptions instead of an object placeholder', () => {
    expect(llmErrorMessage({
      code: 403,
      message: 'REQUEST_ACCESS_DENIED',
      data: {description: 'No access-control rule is defined for the candidate endpoint.'},
    })).toBe('No access-control rule is defined for the candidate endpoint. — REQUEST_ACCESS_DENIED');
  });

  it('uses a stable message for an empty failure response', () => {
    expect(llmErrorMessage({})).toBe('The LLM operation failed without an error message.');
  });
});
