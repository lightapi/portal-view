import { describe, expect, it } from 'vitest';
import { analyzeInputSchema, buildToolMetadata, enrichToolMetadataFields, validateToolMetadataInputs } from './toolMetadata';

describe('MCP composed input schema authoring', () => {
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: { common: { type: 'string' } },
    oneOf: [
      { $ref: '#/$defs/event' },
      { properties: { personId: { type: 'string', 'x-mcp-header': 'Mcp-Param-Person-Id' } } },
    ],
    $defs: { event: { properties: { eventType: { type: 'string' } } } },
    unevaluatedProperties: false,
  };

  it('previews direct, referenced, variant-only, and conditional header properties', () => {
    const analysis = analyzeInputSchema(schema);
    expect(analysis.valid).toBe(true);
    expect(analysis.closed).toBe(true);
    expect(analysis.properties).toEqual([
      { name: 'common', conditional: false },
      { name: 'eventType', conditional: true },
      { name: 'personId', conditional: true, headerName: 'Mcp-Param-Person-Id' },
    ]);
    expect(analysis.warnings[0]).toContain('Some MCP clients');
  });

  it('surfaces malformed schemas and mapping-policy conflicts before submit', () => {
    expect(analyzeInputSchema('{').errors[0]).toContain('non-empty JSON object');
    expect(validateToolMetadataInputs([{
      name: 'composed',
      inputSchema: schema,
      requireCompleteParameterMappings: true,
      unmappedArguments: 'reject',
      parameterMappings: { common: 'query' },
    }])).toContain('composed: missing parameter mappings for eventType, personId.');
  });

  it('keeps mapping controls distinct in generated metadata', () => {
    const metadata = buildToolMetadata({
      parameterMappings: { common: 'query' },
      requireCompleteParameterMappings: true,
      unmappedArguments: 'reject',
    });
    expect(metadata.routing).toMatchObject({
      parameters: { common: 'query' },
      requireCompleteParameterMappings: true,
      unmappedArguments: 'reject',
    });
  });

  it('defaults finite closed generated schemas to strict controls and legacy open schemas conservatively', () => {
    expect(enrichToolMetadataFields({ inputSchema: schema })).toMatchObject({
      requireCompleteParameterMappings: true,
      unmappedArguments: 'reject',
    });
    expect(enrichToolMetadataFields({ inputSchema: { type: 'object' } })).toMatchObject({
      requireCompleteParameterMappings: false,
      unmappedArguments: 'methodDefault',
    });
    expect(analyzeInputSchema({
      type: 'object',
      properties: { config: { type: 'object', patternProperties: { '^x-': { type: 'string' } } } },
      additionalProperties: false,
    }).openEnded).toBe(false);
  });

  it('includes if-declared argument names in mapping completeness', () => {
    const conditional = {
      type: 'object',
      if: { properties: { kind: { type: 'string' } }, required: ['kind'] },
      then: { properties: { detail: { type: 'string' } } },
      unevaluatedProperties: false,
    };
    expect(analyzeInputSchema(conditional).properties).toEqual([
      { name: 'kind', conditional: true },
      { name: 'detail', conditional: true },
    ]);
    expect(validateToolMetadataInputs([{
      name: 'conditional', inputSchema: conditional,
      requireCompleteParameterMappings: true, unmappedArguments: 'reject',
      parameterMappings: { detail: 'body' },
    }])).toContain('conditional: missing parameter mappings for kind.');
  });

  it('blocks headers covered by sensitive ancestors and wildcard masks', () => {
    for (const inputSchema of [
      {
        type: 'object',
        properties: {
          credentials: {
            type: 'object', 'x-sensitive': true,
            properties: { token: { type: 'string', 'x-mcp-header': 'Mcp-Param-Token' } },
          },
        },
      },
      {
        type: 'object',
        properties: { secret_key: { type: 'string', 'x-mcp-header': 'X-Secret-Key' } },
        patternProperties: { '^secret_': { 'x-sensitive': true } },
      },
    ]) {
      expect(analyzeInputSchema(inputSchema).errors.some((error) =>
        error.includes('x-mcp-header cannot expose sensitive property'))).toBe(true);
    }
  });
});
