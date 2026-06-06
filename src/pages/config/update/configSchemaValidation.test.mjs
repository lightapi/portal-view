import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseCompactJsonValue,
  registerConfigPropertyValidator,
  validateConfigStructuredValue,
  validateJsonSchemaValue,
} from './configSchemaValidation.js';

test('validates string array values', () => {
  const schema = { type: 'array', items: { type: 'string' } };
  assert.deepEqual(validateJsonSchemaValue(['one', 'two'], schema), []);
  assert.match(validateJsonSchemaValue(['one', 2], schema).join('\n'), /must be string/);
});

test('validates object array values', () => {
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    },
  };
  assert.deepEqual(validateJsonSchemaValue([{ name: 'alice' }], schema), []);
  assert.match(validateJsonSchemaValue([{}], schema).join('\n'), /name.*required/);
});

test('validates map values with required and additionalProperties', () => {
  const schema = {
    type: 'object',
    required: ['issuer'],
    properties: { issuer: { type: 'string' } },
    additionalProperties: false,
  };
  assert.deepEqual(validateConfigStructuredValue({ valueType: 'map' }, '{"issuer":"lightapi"}', schema), []);
  assert.match(validateConfigStructuredValue({ valueType: 'map' }, '{}', schema).join('\n'), /issuer.*required/);
  assert.match(validateConfigStructuredValue({ valueType: 'map' }, '{"issuer":"lightapi","extra":true}', schema).join('\n'), /extra.*not allowed/);
});

test('reports malformed JSON before schema validation', () => {
  assert.match(parseCompactJsonValue('{broken').error, /Expected|JSON|position/);
  assert.match(validateConfigStructuredValue({ valueType: 'list' }, '{broken', { type: 'array' }).join('\n'), /Expected|JSON|position/);
});

test('supports custom validators by property key', () => {
  registerConfigPropertyValidator('security.yml.claims', (value) => (
    value.required === true ? [] : 'required must be true.'
  ));
  const row = { valueType: 'map', configName: 'security.yml', propertyName: 'claims' };
  assert.match(validateConfigStructuredValue(row, '{"required":false}', { type: 'object' }).join('\n'), /required must be true/);
});
