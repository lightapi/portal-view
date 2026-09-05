import { describe, expect, it } from 'vitest';
import { codingPayload, emptyCodingInput, importCodingRequest } from './codingRequest';
const input = { ...emptyCodingInput, artifactUri: 'file:///spool/repo.bundle', digest: 'sha256:' + 'a'.repeat(64), size: '42', baseRevision: 'b'.repeat(40) };
describe('typed coding request', () => {
  it('builds the fixed implementation authority and imports a generated smoke request', () => {
    const coding = codingPayload(input);
    expect(coding.allowedTools).toEqual(['fs.read', 'fs.write', 'process.exec']);
    expect(coding.repository.size).toBe(42);
    expect(coding.writableRoots).toEqual(['/workspace/repository']);
    expect(importCodingRequest({ profile: 'coding', text: 'Change README', coding })).toEqual({ input, text: 'Change README' });
  });
  it('rejects remote bundles, noncanonical digests, short revisions and unbounded integers', () => {
    for (const change of [{ artifactUri: 'https://example.com/repo' }, { artifactUri: 'file://other/repo' }, { digest: 'abc' }, { baseRevision: 'HEAD' }, { size: '0' }, { maximumPatchBytes: '9007199254740992' }, { workspaceRoot: '/workspace/../secret' }])
      expect(() => codingPayload({ ...input, ...change })).toThrow();
  });
  it('does not silently widen imported tools or writable roots, or drop review authority', () => {
    for (const change of [{ allowedTools: ['fs.read'] }, { writableRoots: ['/elsewhere'] }, { role: 'review' }, { remediation: {} }])
      expect(() => importCodingRequest({ profile: 'coding', text: 'request', coding: { ...codingPayload(input), ...change } })).toThrow();
  });
});
