import { describe, expect, it } from 'vitest';
import { canonicalJson, canonicalSha256 } from './a2aCanonical';

describe('A2A RFC 8785 canonical JSON', () => {
  it('uses UTF-16 key order and ECMAScript number serialization', async () => {
    const value = { url: 'lower', rate: 1e3, budget: 1.0, Url: 'upper' };

    expect(canonicalJson(value)).toBe(
      '{"Url":"upper","budget":1,"rate":1000,"url":"lower"}',
    );
    expect(await canonicalSha256(value)).toBe(
      'sha256:79a9741949a41a62463c4259d0ac0706dd015ef23c3c80755f4c52a20a9e012f',
    );
  });

  it('sorts integer-looking object keys lexically instead of JSON insertion order', () => {
    expect(canonicalJson({ 2: 'two', 10: 'ten' })).toBe('{"10":"ten","2":"two"}');
  });
});
