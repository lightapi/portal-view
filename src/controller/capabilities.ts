export interface RuntimeCapabilities {
  runtimeInstanceId: string;
  source: 'runtime' | 'unavailable';
  tools: string[];
  reason?: string;
}

export const RUNTIME_CAPABILITIES_UNAVAILABLE = 'Runtime capability discovery is unavailable';

export function normalizeRuntimeCapabilities(
  runtimeInstanceId: string,
  value: any,
  controllerTools: ReadonlySet<string>,
): RuntimeCapabilities {
  if (value?.source !== 'runtime') {
    return {
      runtimeInstanceId,
      source: 'unavailable',
      tools: [],
      reason: typeof value?.reason === 'string'
        ? value.reason.slice(0, 256)
        : RUNTIME_CAPABILITIES_UNAVAILABLE,
    };
  }
  const tools: string[] = Array.isArray(value.tools)
    ? (value.tools as unknown[]).filter((tool: unknown): tool is string =>
        typeof tool === 'string' && controllerTools.has(tool))
    : [];
  return { runtimeInstanceId, source: 'runtime', tools: Array.from(new Set(tools)).sort() };
}
