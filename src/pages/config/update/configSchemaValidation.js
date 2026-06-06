function typeList(schema) {
  if (!schema || schema.type === undefined) return [];
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function allowsType(schema, type) {
  const types = typeList(schema);
  return types.length === 0 || types.includes(type);
}

function valueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function formatPath(path) {
  return path || '$';
}

function validateType(schema, value, path, errors) {
  const types = typeList(schema);
  if (types.length === 0) return;
  const actual = valueType(value);
  const valid = types.some((type) => {
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'object') return actual === 'object';
    if (type === 'array') return actual === 'array';
    return actual === type;
  });
  if (!valid) errors.push(`${formatPath(path)} must be ${types.join(' or ')}.`);
}

function validateString(schema, value, path, errors) {
  if (typeof value !== 'string') return;
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`${formatPath(path)} must be at least ${schema.minLength} characters.`);
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push(`${formatPath(path)} must be at most ${schema.maxLength} characters.`);
  }
  if (schema.pattern) {
    try {
      if (!new RegExp(schema.pattern).test(value)) errors.push(`${formatPath(path)} must match ${schema.pattern}.`);
    } catch {
      errors.push(`${formatPath(path)} has an invalid schema pattern.`);
    }
  }
}

function validateNumber(schema, value, path, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${formatPath(path)} must be >= ${schema.minimum}.`);
  if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${formatPath(path)} must be <= ${schema.maximum}.`);
}

function validateObject(schema, value, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (value[key] === undefined) errors.push(`${formatPath(path ? `${path}.${key}` : `$.${key}`)} is required.`);
  }

  const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (value[key] !== undefined) validateJsonSchemaNode(propertySchema, value[key], path ? `${path}.${key}` : `$.${key}`, errors);
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        errors.push(`${formatPath(path ? `${path}.${key}` : `$.${key}`)} is not allowed.`);
      }
    }
  } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        validateJsonSchemaNode(schema.additionalProperties, value[key], path ? `${path}.${key}` : `$.${key}`, errors);
      }
    }
  }
}

function validateArray(schema, value, path, errors) {
  if (!Array.isArray(value)) return;
  if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${formatPath(path)} must have at least ${schema.minItems} items.`);
  if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${formatPath(path)} must have at most ${schema.maxItems} items.`);
  if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
    value.forEach((item, index) => validateJsonSchemaNode(schema.items, item, `${formatPath(path)}[${index}]`, errors));
  }
}

function validateJsonSchemaNode(schema, value, path, errors) {
  if (!schema || typeof schema !== 'object') return;
  validateType(schema, value, path, errors);
  if (schema.const !== undefined && value !== schema.const) errors.push(`${formatPath(path)} must be ${JSON.stringify(schema.const)}.`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${formatPath(path)} must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}.`);
  }
  validateString(schema, value, path, errors);
  validateNumber(schema, value, path, errors);
  validateObject(schema, value, path, errors);
  validateArray(schema, value, path, errors);
}

export function schemaCompatibleWithValueType(schema, valueType) {
  const type = (valueType || '').toLowerCase();
  if (type === 'list') return allowsType(schema, 'array');
  if (type === 'map') return allowsType(schema, 'object');
  return false;
}

export function parseSchemaBody(schemaBody) {
  if (!schemaBody || typeof schemaBody !== 'string') return { error: 'Schema body is empty.' };
  try {
    const schema = JSON.parse(schemaBody);
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return { error: 'Schema body must be a JSON object.' };
    return { schema };
  } catch (error) {
    return { error: error?.message || 'Schema body is not valid JSON.' };
  }
}

export function validateJsonSchemaValue(value, schema) {
  const errors = [];
  validateJsonSchemaNode(schema, value, '$', errors);
  return errors;
}

export function parseCompactJsonValue(rawValue) {
  try {
    return { value: JSON.parse(rawValue) };
  } catch (error) {
    return { error: error?.message || 'Value is not valid JSON.' };
  }
}

const customValidators = new Map();

export function registerConfigPropertyValidator(key, validator) {
  const validators = customValidators.get(key) || [];
  validators.push(validator);
  customValidators.set(key, validators);
}

export function configPropertyValidatorKeys(row) {
  return [
    row?.configId && row?.propertyId ? `${row.configId}:${row.propertyId}` : null,
    row?.configName && row?.propertyName ? `${row.configName}.${row.propertyName}` : null,
    row?.propertyName || null,
  ].filter(Boolean);
}

export function validateCustomConfigProperty(row, value) {
  const errors = [];
  for (const key of configPropertyValidatorKeys(row)) {
    const validators = customValidators.get(key) || [];
    for (const validator of validators) {
      const result = validator(value, row);
      if (Array.isArray(result)) errors.push(...result);
      if (typeof result === 'string' && result) errors.push(result);
    }
  }
  return errors;
}

export function validateConfigStructuredValue(row, rawJsonValue, schema) {
  const parsed = parseCompactJsonValue(rawJsonValue);
  if (parsed.error) return [parsed.error];
  const value = parsed.value;
  const type = (row?.valueType || '').toLowerCase();
  const errors = [];

  if (type === 'list' && !Array.isArray(value)) errors.push('Value must be a JSON array.');
  if (type === 'map' && (!value || typeof value !== 'object' || Array.isArray(value))) errors.push('Value must be a JSON object.');
  if (schema) errors.push(...validateJsonSchemaValue(value, schema));
  errors.push(...validateCustomConfigProperty(row, value));
  return errors;
}

export function formSchemaForConfigValue(schema, valueType) {
  if ((valueType || '').toLowerCase() === 'list') {
    return {
      type: 'object',
      required: ['value'],
      properties: {
        value: schema,
      },
    };
  }
  return schema;
}

export function formModelFromConfigValue(value, valueType) {
  if ((valueType || '').toLowerCase() === 'list') return { value };
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function configValueFromFormModel(model, valueType) {
  if ((valueType || '').toLowerCase() === 'list') return model?.value ?? [];
  return model ?? {};
}
