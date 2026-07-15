import { describe, expect, it } from 'vitest';
import { validateAndNormalizeValue } from './configValue';

describe('validateAndNormalizeValue', () => {
  it('rejects empty float values instead of coercing them to zero', () => {
    expect(validateAndNormalizeValue('float', '')).toEqual({ error: 'Value must be a number.' });
    expect(validateAndNormalizeValue('float', '   ')).toEqual({ error: 'Value must be a number.' });
  });

  it('continues to normalize valid float values', () => {
    expect(validateAndNormalizeValue('float', ' 1.50 ')).toEqual({ value: '1.5' });
    expect(validateAndNormalizeValue('float', '0')).toEqual({ value: '0' });
  });
});
