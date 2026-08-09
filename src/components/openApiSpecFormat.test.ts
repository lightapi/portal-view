import { describe, expect, it } from 'vitest';
import {
  convertOpenApiSpec,
  detectOpenApiSpecFormat,
  parseOpenApiSpec,
} from './openApiSpecFormat';

const yamlSpec = `openapi: 3.1.0
info:
  title: Petstore
  version: 1.0.0
paths: {}
`;

describe('OpenAPI specification formatting', () => {
  it('detects and parses JSON and YAML object documents', () => {
    expect(detectOpenApiSpecFormat('{"openapi":"3.1.0"}')).toBe('json');
    expect(detectOpenApiSpecFormat(yamlSpec)).toBe('yaml');
    expect(parseOpenApiSpec(yamlSpec).document).toMatchObject({
      openapi: '3.1.0',
      info: { title: 'Petstore' },
    });
  });

  it('converts between YAML and formatted JSON without changing document values', () => {
    const json = convertOpenApiSpec(yamlSpec, 'yaml', 'json');
    expect(json.error).toBeNull();
    expect(JSON.parse(json.value)).toMatchObject({ openapi: '3.1.0', paths: {} });

    const yaml = convertOpenApiSpec(json.value, 'json', 'yaml');
    expect(yaml.error).toBeNull();
    expect(parseOpenApiSpec(yaml.value, 'yaml').document).toEqual(JSON.parse(json.value));
  });

  it('rejects invalid syntax and non-object roots while allowing an empty specification', () => {
    expect(parseOpenApiSpec('{', 'json').error).toContain('not valid JSON');
    expect(parseOpenApiSpec('- one\n- two\n', 'yaml').error).toBe('The specification root must be an object.');
    expect(parseOpenApiSpec(null).error).toBe('The specification must be text.');
    expect(parseOpenApiSpec('')).toEqual({ document: null, error: null });
  });

  it('returns conversion errors for circular YAML aliases instead of throwing', () => {
    const result = convertOpenApiSpec('info: &info { title: API, self: *info }\n', 'yaml', 'json');
    expect(result.error).toContain('circular reference');
    expect(result.value).toContain('self: *info');
  });

  it('rejects YAML values that JSON cannot represent without data loss', () => {
    expect(convertOpenApiSpec('value: .inf\n', 'yaml', 'json').error).toContain('non-finite number');
    expect(convertOpenApiSpec('value: .nan\n', 'yaml', 'json').error).toContain('non-finite number');
    expect(
      convertOpenApiSpec('value: 123456789012345678901234567890\n', 'yaml', 'json').error,
    ).toContain("outside JSON's safe range");
  });
});
