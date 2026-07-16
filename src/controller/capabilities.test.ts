import { describe, expect, it } from 'vitest';
import { normalizeRuntimeCapabilities } from './capabilities';

describe('runtime capability intersection', () => {
  it('never exposes runtime mutations hidden by the scope-filtered controller catalog', () => {
    const capability = normalizeRuntimeCapabilities('runtime-a', {
      source: 'runtime',
      tools: ['get_service_info', 'set_loggers', 'shutdown_service'],
    }, new Set(['get_service_info']));
    expect(capability.tools).toEqual(['get_service_info']);
  });

  it('defaults malformed and failed discovery to unavailable', () => {
    expect(normalizeRuntimeCapabilities('runtime-a', null, new Set()).source).toBe('unavailable');
    expect(normalizeRuntimeCapabilities('runtime-a', { source: 'runtime' }, new Set()).tools).toEqual([]);
  });

  it('bounds safe failure reasons', () => {
    const capability = normalizeRuntimeCapabilities('runtime-a', {
      source: 'unavailable', reason: 'x'.repeat(1000),
    }, new Set());
    expect(capability.reason).toHaveLength(256);
  });
});
