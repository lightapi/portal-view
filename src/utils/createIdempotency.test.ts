import {afterEach, describe, expect, it, vi} from 'vitest';
import {createIdempotencyKey} from './createIdempotency';

describe('createIdempotencyKey', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the browser cryptographic UUID generator', () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValue('00000000-0000-4000-8000-000000000123');

    expect(createIdempotencyKey()).toBe('00000000-0000-4000-8000-000000000123');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
