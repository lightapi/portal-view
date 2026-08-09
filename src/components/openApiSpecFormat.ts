import YAML from 'yaml';

export type OpenApiSpecFormat = 'yaml' | 'json';

export type OpenApiSpecParseResult = {
  document: Record<string, unknown> | null;
  error: string | null;
};

export type OpenApiSpecConversionResult = {
  value: string;
  error: string | null;
};

type JsonCompatibilityResult =
  | { value: unknown; error: null }
  | { value: null; error: string };

export function detectOpenApiSpecFormat(value: unknown): OpenApiSpecFormat {
  if (typeof value !== 'string') return 'yaml';
  if (!value.trim()) return 'yaml';
  try {
    JSON.parse(value);
    return 'json';
  } catch {
    return 'yaml';
  }
}

export function parseOpenApiSpec(
  value: unknown,
  format: OpenApiSpecFormat = detectOpenApiSpecFormat(value),
): OpenApiSpecParseResult {
  if (typeof value !== 'string') {
    return { document: null, error: 'The specification must be text.' };
  }
  if (!value.trim()) return { document: null, error: null };

  try {
    const parsed = format === 'json' ? JSON.parse(value) : YAML.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { document: null, error: 'The specification root must be an object.' };
    }
    return { document: parsed as Record<string, unknown>, error: null };
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    return {
      document: null,
      error: `The specification is not valid ${format.toUpperCase()}.${detail}`,
    };
  }
}

export function convertOpenApiSpec(
  value: string,
  from: OpenApiSpecFormat,
  to: OpenApiSpecFormat,
): OpenApiSpecConversionResult {
  const parsed = parseOpenApiSpec(value, from);
  if (parsed.error) return { value, error: parsed.error };
  if (parsed.document === null) return { value: '', error: null };

  try {
    if (to === 'json') {
      // Preserve YAML integers until we can verify they fit JSON's safe numeric range.
      const document = from === 'yaml'
        ? YAML.parse(value, { intAsBigInt: true })
        : parsed.document;
      const compatible = toJsonCompatible(document);
      if (compatible.error) return { value, error: compatible.error };
      return { value: JSON.stringify(compatible.value, null, 2), error: null };
    }

    return { value: YAML.stringify(parsed.document), error: null };
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    return {
      value,
      error: `Could not convert the specification to ${to.toUpperCase()}.${detail}`,
    };
  }
}

function toJsonCompatible(
  value: unknown,
  path = '$',
  ancestors = new WeakSet<object>(),
): JsonCompatibilityResult {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return { value, error: null };
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { value, error: null }
      : { value: null, error: `Cannot convert to JSON because ${path} contains a non-finite number.` };
  }

  if (typeof value === 'bigint') {
    const numericValue = Number(value);
    return Number.isSafeInteger(numericValue)
      ? { value: numericValue, error: null }
      : { value: null, error: `Cannot convert to JSON because ${path} contains an integer outside JSON's safe range.` };
  }

  if (typeof value !== 'object') {
    return { value: null, error: `Cannot convert to JSON because ${path} contains an unsupported value.` };
  }

  if (ancestors.has(value)) {
    return { value: null, error: `Cannot convert to JSON because ${path} contains a circular reference.` };
  }

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return { value: null, error: `Cannot convert to JSON because ${path} contains a non-JSON object.` };
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    const converted: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const item = toJsonCompatible(value[index], `${path}[${index}]`, ancestors);
      if (item.error) return item;
      converted.push(item.value);
    }
    ancestors.delete(value);
    return { value: converted, error: null };
  }

  const converted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const item = toJsonCompatible(child, `${path}.${key}`, ancestors);
    if (item.error) return item;
    converted[key] = item.value;
  }
  ancestors.delete(value);
  return { value: converted, error: null };
}
