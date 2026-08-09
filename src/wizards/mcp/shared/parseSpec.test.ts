import { describe, expect, it } from 'vitest';
import { parseSpec, tryParseDoc } from './parseSpec';

describe('parseSpec', () => {
  it('accepts JSON specs and preserves their original source for preview', () => {
    const source = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'JSON API', version: '1.0.0' },
      paths: {},
    });

    const preview = parseSpec(source, 'openapi.json');
    expect(preview).toMatchObject({
      apiName: 'JSON API',
      apiVersion: '1.0.0',
      apiType: 'openapi',
      rawFileName: 'openapi.json',
      rawText: source,
    });
  });

  it('rejects scalar and malformed documents', () => {
    expect(tryParseDoc('plain text')).toBeNull();
    expect(tryParseDoc(null)).toBeNull();
    expect(() => parseSpec('{', 'openapi.json')).toThrow(/valid JSON or YAML/);
  });
});
