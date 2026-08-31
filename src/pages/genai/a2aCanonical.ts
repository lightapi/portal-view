const compareUtf16 = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

/** RFC 8785 JSON serialization for Portal-side preview digests. */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON requires a finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort(compareUtf16)
      .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value}.`);
};

export const canonicalSha256 = async (value: unknown): Promise<string> => {
  const bytes = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(canonicalJson(value)),
  );
  return `sha256:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
};
