import YAML from 'yaml';
import type { ConfigUpdateProperty } from './types';

export function rowKey(row: Pick<ConfigUpdateProperty, 'scope' | 'hostId' | 'instanceId' | 'instanceApiId' | 'instanceAppId' | 'configId' | 'propertyId'>) {
  return [
    row.scope,
    row.hostId,
    row.instanceId ?? '',
    row.instanceApiId ?? '',
    row.instanceAppId ?? '',
    row.configId,
    row.propertyId,
  ].join(':');
}

export function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

export function currentCommittedValue(row: ConfigUpdateProperty) {
  return row.overrideValue ?? row.effectiveValue ?? row.inheritedValue ?? row.defaultValue ?? '';
}

export function validateAndNormalizeValue(valueType: string | undefined, rawValue: string) {
  const type = (valueType || 'string').toLowerCase();
  const value = rawValue ?? '';

  if (type === 'boolean') {
    if (value === 'true' || value === 'false') return { value };
    return { error: 'Value must be true or false.' };
  }

  if (type === 'integer') {
    if (/^-?\d+$/.test(value.trim())) return { value: String(Number.parseInt(value.trim(), 10)) };
    return { error: 'Value must be an integer.' };
  }

  if (type === 'float') {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return { value: String(numberValue) };
    return { error: 'Value must be a number.' };
  }

  if (type === 'list') {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return { error: 'Value must be a JSON array.' };
      return { value: JSON.stringify(parsed) };
    } catch {
      return { error: 'Value must be valid JSON.' };
    }
  }

  if (type === 'map') {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'Value must be a JSON object.' };
      return { value: JSON.stringify(parsed) };
    } catch {
      return { error: 'Value must be valid JSON.' };
    }
  }

  return { value };
}

export function structuredInitialValue(valueType: string | undefined, value: string | null | undefined) {
  if (value && value.trim()) return value;
  return (valueType || '').toLowerCase() === 'list' ? '[]' : '{}';
}

export function parseStructuredValue(valueType: string | undefined, rawValue: string, mode: 'json' | 'yaml') {
  let parsed: unknown;
  try {
    parsed = mode === 'json' ? JSON.parse(rawValue) : YAML.parse(rawValue);
  } catch (error: any) {
    return { error: error?.message || 'Value is not valid.' };
  }

  if ((valueType || '').toLowerCase() === 'list' && !Array.isArray(parsed)) {
    return { error: 'Value must be an array.' };
  }
  if ((valueType || '').toLowerCase() === 'map' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
    return { error: 'Value must be an object.' };
  }

  return { value: JSON.stringify(parsed) };
}

export function toYaml(value: string) {
  try {
    return YAML.stringify(JSON.parse(value));
  } catch {
    return value;
  }
}

export function toPrettyJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
