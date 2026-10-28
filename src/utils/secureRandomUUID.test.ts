import { afterEach, describe, expect, it, vi } from 'vitest';
import { secureRandomUUID } from './secureRandomUUID';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('secureRandomUUID', () => {
  it('prefers native UUID generation and preserves its receiver', () => {
    const crypto = { randomUUID: vi.fn(function (this: unknown) {
      expect(this).toBe(crypto);
      return '00000000-0000-4000-8000-000000000001';
    }), getRandomValues: vi.fn() };
    vi.stubGlobal('crypto', crypto);
    expect(secureRandomUUID()).toBe('00000000-0000-4000-8000-000000000001');
    expect(crypto.getRandomValues).not.toHaveBeenCalled();
  });
  it('uses all 16 random bytes and sets the UUID version and variant without randomUUID', () => {
    const crypto = { getRandomValues: vi.fn(function (this: unknown, bytes: Uint8Array) {
      expect(this).toBe(crypto);
      expect(bytes).toHaveLength(16);
      bytes.fill(255);
      return bytes;
    }) };
    vi.stubGlobal('crypto', crypto);
    expect(secureRandomUUID()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(crypto.getRandomValues).toHaveBeenCalledOnce();
  });
  it.each([undefined, {}, { randomUUID: undefined, getRandomValues: undefined }])('fails closed without Web Crypto: %s', crypto => {
    vi.stubGlobal('crypto', crypto);
    const weak = vi.spyOn(Math, 'random');
    expect(() => secureRandomUUID()).toThrow('Secure random ID generation is unavailable');
    expect(weak).not.toHaveBeenCalled();
  });
  it('propagates provider failure rather than downgrading randomness', () => {
    const fallback = vi.fn();
    vi.stubGlobal('crypto', { randomUUID: () => { throw new Error('provider failed'); }, getRandomValues: fallback });
    expect(() => secureRandomUUID()).toThrow('provider failed');
    expect(fallback).not.toHaveBeenCalled();
  });
});
