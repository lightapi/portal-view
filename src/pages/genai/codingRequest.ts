export type CodingInput = {
  artifactUri: string; digest: string; size: string; baseRevision: string;
  workspaceRoot: string; maximumPatchBytes: string; maximumChangedFiles: string;
};
export const emptyCodingInput: CodingInput = {
  artifactUri: '', digest: '', size: '', baseRevision: '', workspaceRoot: '/workspace/repository',
  maximumPatchBytes: '65536', maximumChangedFiles: '1',
};
/** crypto.randomUUID is secure-context only; getRandomValues is not. The chat page
 *  also serves ws:// over plain http, where the former is undefined. */
export function clientMessageId(): string {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof source?.getRandomValues === 'function') source.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const positive = (text: string, name: string) => {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer.`);
  return value;
};
export function codingPayload(input: CodingInput) {
  let uri: URL;
  try { uri = new URL(input.artifactUri); } catch { throw new Error('Repository URI must be an absolute local file URI.'); }
  if (uri.protocol !== 'file:' || uri.host || uri.search || uri.hash || !uri.pathname.startsWith('/')) throw new Error('Repository URI must be a local file URI without host, query, or fragment.');
  if (!/^sha256:[0-9a-f]{64}$/.test(input.digest)) throw new Error('Bundle digest must be sha256 followed by 64 lowercase hex digits.');
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(input.baseRevision)) throw new Error('Base revision must be a full Git commit hash.');
  if (!input.workspaceRoot.startsWith('/') || input.workspaceRoot.split('/').some(p => p === '..' || p === '.') || input.workspaceRoot.includes('\\')) throw new Error('Workspace root must be an absolute worker path without traversal.');
  return {
    repository: { artifactUri: input.artifactUri, digest: input.digest, size: positive(input.size, 'Bundle size'), mediaType: 'application/x-git-bundle' },
    baseRevision: input.baseRevision, workspaceRoot: input.workspaceRoot,
    writableRoots: [input.workspaceRoot], allowedTools: ['fs.read', 'fs.write', 'process.exec'],
    maximumPatchBytes: positive(input.maximumPatchBytes, 'Patch byte limit'),
    maximumChangedFiles: positive(input.maximumChangedFiles, 'Changed file limit'), role: 'implement',
  };
}
export function importCodingRequest(value: unknown): { input: CodingInput; text: string } {
  const request = value as Record<string, unknown>;
  if (!request || request.profile !== 'coding' || typeof request.text !== 'string') throw new Error('Import a typed coding request containing profile, text, and coding.');
  const coding = request.coding as ReturnType<typeof codingPayload> & { reviewInput?: unknown; remediation?: unknown };
  if (!coding || coding.role !== 'implement' || !coding.repository || coding.repository.mediaType !== 'application/x-git-bundle') throw new Error('Only implementation requests with a Git bundle are supported by this form.');
  if (coding.reviewInput || coding.remediation) throw new Error('Review and remediation requests require their dedicated contracts.');
  const input: CodingInput = {
    artifactUri: coding.repository.artifactUri, digest: coding.repository.digest, size: String(coding.repository.size),
    baseRevision: coding.baseRevision, workspaceRoot: coding.workspaceRoot,
    maximumPatchBytes: String(coding.maximumPatchBytes), maximumChangedFiles: String(coding.maximumChangedFiles),
  };
  const normalized = codingPayload(input);
  if (JSON.stringify(coding.writableRoots) !== JSON.stringify(normalized.writableRoots)
      || !Array.isArray(coding.allowedTools) || [...coding.allowedTools].sort().join() !== [...normalized.allowedTools].sort().join()) throw new Error('Imported writable roots or tools differ from the supported implementation profile.');
  return { input, text: request.text };
}
