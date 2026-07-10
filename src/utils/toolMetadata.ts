export type ToolMetadataCarrier = {
  name?: string;
  endpoint?: string;
  method?: string;
  apiMethod?: string;
  path?: string;
  inputSchema?: unknown;
  toolMetadata?: unknown;
  routingDomain?: string;
  semanticNamespace?: string;
  sensitivityTier?: string;
  semanticWeight?: number | string;
  sourceProtocol?: string;
  targetPersonas?: string | string[];
  lifecycleStatus?: string;
  costTier?: string;
  readOnly?: boolean;
  idempotent?: boolean;
  destructive?: boolean;
  humanApprovalRequired?: boolean;
  estimatedLatencyMs?: number | string;
  cacheTtlSeconds?: number | string;
  semanticDescription?: string;
  semanticKeywords?: string | string[];
  parameterMappings?: Record<string, string>;
};

export type ToolMetadataEditableFields = {
  lifecycleStatus?: string;
  costTier?: string;
  readOnly?: boolean;
  idempotent?: boolean;
  destructive?: boolean;
  humanApprovalRequired?: boolean;
  estimatedLatencyMs?: number;
  cacheTtlSeconds?: number;
  semanticDescription?: string;
  semanticKeywords?: string;
  parameterMappings?: Record<string, string>;
};

export const PARAMETER_LOCATION_VALUES = ['path', 'query', 'header', 'cookie', 'body'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

export function parseToolMetadataObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    if (!value.trim()) return {};
    try {
      const parsed: unknown = JSON.parse(value);
      return cloneRecord(parsed);
    } catch {
      return {};
    }
  }
  return cloneRecord(value);
}

function childRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  return cloneRecord(parent[key]);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', 'y', '1', 'on'].includes(normalized)) return true;
      if (['false', 'no', 'n', '0', 'off'].includes(normalized)) return false;
    }
  }
  return undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function integerOrUndefined(value: unknown): number | undefined {
  const parsed = numberOrUndefined(value);
  if (parsed === undefined) return undefined;
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function cleanStringList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.trim().startsWith('[')
        ? parseJsonArray(value)
        : value.split(',')
      : value == null
        ? []
        : [value];

  return Array.from(new Set(raw.map((item) => String(item).trim()).filter(Boolean)));
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return value.split(',');
  }
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, val]) => [key, firstString(val)] as const)
      .filter((entry): entry is [string, string] => !!entry[1]),
  );
}

function assignString(target: Record<string, unknown>, key: string, value: unknown) {
  const text = firstString(value);
  if (text) target[key] = text;
}

function assignNumber(target: Record<string, unknown>, key: string, value: unknown) {
  const number = numberOrUndefined(value);
  if (number !== undefined) target[key] = number;
}

function assignInteger(target: Record<string, unknown>, key: string, value: unknown) {
  const number = integerOrUndefined(value);
  if (number !== undefined && number >= 0) target[key] = number;
}

function methodDefaults(tool: ToolMetadataCarrier) {
  const method = firstString(tool.apiMethod, tool.method)?.toLowerCase() ?? '';
  const readOnly = ['get', 'head', 'options'].includes(method);
  return {
    readOnly,
    destructive: method === 'delete',
    idempotent: readOnly,
  };
}

export function enrichToolMetadataFields<T extends ToolMetadataCarrier>(tool: T): T & ToolMetadataEditableFields {
  const metadata = parseToolMetadataObject(tool.toolMetadata);
  const routing = childRecord(metadata, 'routing');
  const safety = childRecord(metadata, 'safety');
  const runtime = childRecord(metadata, 'runtime');
  const lifecycle = childRecord(metadata, 'lifecycle');
  const defaults = methodDefaults(tool);

  const semanticWeight = numberOrUndefined(firstString(tool.semanticWeight, routing.semanticWeight, metadata.semanticWeight));
  const estimatedLatencyMs = integerOrUndefined(firstString(tool.estimatedLatencyMs, runtime.estimatedLatencyMs, metadata.estimatedLatencyMs));
  const cacheTtlSeconds = integerOrUndefined(firstString(tool.cacheTtlSeconds, runtime.cacheTtlSeconds, metadata.cacheTtlSeconds));

  return {
    ...tool,
    toolMetadata: Object.keys(metadata).length > 0 ? metadata : tool.toolMetadata,
    routingDomain: firstString(tool.routingDomain, routing.domain, metadata.domain),
    semanticNamespace: firstString(tool.semanticNamespace, routing.semanticNamespace, metadata.semanticNamespace),
    sensitivityTier: firstString(tool.sensitivityTier, routing.sensitivityTier, safety.sensitivityTier, metadata.sensitivityTier, metadata.sensitivity_tier),
    semanticWeight: semanticWeight ?? 1,
    sourceProtocol: firstString(tool.sourceProtocol, routing.sourceProtocol, metadata.sourceProtocol),
    targetPersonas: firstString(tool.targetPersonas, routing.targetPersonas),
    lifecycleStatus: firstString(tool.lifecycleStatus, lifecycle.status, metadata.lifecycleStatus, metadata.lifecycle_status) ?? 'active',
    costTier: firstString(tool.costTier, runtime.costTier, metadata.costTier, metadata.cost_tier),
    readOnly: firstBoolean(tool.readOnly, safety.read_only, safety.readOnly, metadata.read_only, metadata.readOnly) ?? defaults.readOnly,
    idempotent: firstBoolean(tool.idempotent, safety.idempotent, metadata.idempotent) ?? defaults.idempotent,
    destructive: firstBoolean(tool.destructive, safety.destructive, metadata.destructive) ?? defaults.destructive,
    humanApprovalRequired: firstBoolean(tool.humanApprovalRequired, safety.humanApprovalRequired, safety.approvalRequired, safety.requiresApproval, metadata.humanApprovalRequired, metadata.approvalRequired, metadata.requiresApproval) ?? false,
    estimatedLatencyMs,
    cacheTtlSeconds,
    semanticDescription: firstString(tool.semanticDescription, routing.semanticDescription, metadata.semanticDescription),
    semanticKeywords: cleanStringList(tool.semanticKeywords ?? routing.semanticKeywords ?? metadata.semanticKeywords).join(', '),
    parameterMappings: {
      ...stringRecord(routing.parameters),
      ...stringRecord(tool.parameterMappings),
    },
  };
}

export function buildToolMetadata(tool: ToolMetadataCarrier): Record<string, unknown> {
  const metadata = parseToolMetadataObject(tool.toolMetadata);
  const routing = childRecord(metadata, 'routing');
  const safety = childRecord(metadata, 'safety');
  const runtime = childRecord(metadata, 'runtime');
  const lifecycle = childRecord(metadata, 'lifecycle');
  const defaults = methodDefaults(tool);

  assignString(routing, 'domain', tool.routingDomain);
  assignString(routing, 'semanticNamespace', tool.semanticNamespace);
  assignString(routing, 'sensitivityTier', tool.sensitivityTier);
  assignNumber(routing, 'semanticWeight', tool.semanticWeight ?? 1);
  assignString(routing, 'sourceProtocol', tool.sourceProtocol);
  assignString(routing, 'semanticDescription', tool.semanticDescription);

  const personas = cleanStringList(tool.targetPersonas);
  if (personas.length > 0) routing.targetPersonas = personas;

  const keywords = cleanStringList(tool.semanticKeywords);
  if (keywords.length > 0) routing.semanticKeywords = keywords;

  const parameterMappings = stringRecord(tool.parameterMappings);
  if (Object.keys(parameterMappings).length > 0) routing.parameters = parameterMappings;

  safety.read_only = tool.readOnly ?? defaults.readOnly;
  safety.idempotent = tool.idempotent ?? defaults.idempotent;
  safety.destructive = tool.destructive ?? defaults.destructive;
  safety.humanApprovalRequired = tool.humanApprovalRequired ?? false;
  metadata.read_only = safety.read_only;
  metadata.destructive = safety.destructive;

  assignString(runtime, 'costTier', tool.costTier);
  assignInteger(runtime, 'estimatedLatencyMs', tool.estimatedLatencyMs);
  assignInteger(runtime, 'cacheTtlSeconds', tool.cacheTtlSeconds);

  lifecycle.status = firstString(tool.lifecycleStatus) ?? 'active';

  metadata.routing = routing;
  metadata.safety = safety;
  if (Object.keys(runtime).length > 0) metadata.runtime = runtime;
  else delete metadata.runtime;
  metadata.lifecycle = lifecycle;
  return metadata;
}

export function compactToolMetadataForSubmit<T extends ToolMetadataCarrier>(source: T): T {
  const next: Record<string, unknown> = { ...source };
  next.toolMetadata = buildToolMetadata(source);
  delete next.readOnly;
  delete next.idempotent;
  delete next.destructive;
  delete next.humanApprovalRequired;
  delete next.estimatedLatencyMs;
  delete next.cacheTtlSeconds;
  delete next.semanticDescription;
  delete next.semanticKeywords;
  delete next.parameterMappings;
  return next as T;
}

export function inputSchemaPropertyNames(inputSchema: unknown): string[] {
  const schema = parseToolMetadataObject(inputSchema);
  const properties = cloneRecord(schema.properties);
  return Object.keys(properties);
}

export function extractPathParameters(path?: string): string[] {
  if (!path) return [];
  const names = new Set<string>();
  const openApiPattern = /\{([^}/]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = openApiPattern.exec(path)) !== null) {
    const name = match[1]?.trim();
    if (name) names.add(name);
  }
  return Array.from(names);
}

export function missingPathParameterMappings(tool: ToolMetadataCarrier): string[] {
  const mappings = stringRecord(tool.parameterMappings);
  return extractPathParameters(tool.path).filter((name) => mappings[name] !== 'path');
}

export function toolMetadataWarnings(tools: ToolMetadataCarrier[]): string[] {
  return tools.flatMap((tool) => {
    const missing = missingPathParameterMappings(tool);
    if (missing.length === 0) return [];
    const label = firstString(tool.name, tool.endpoint) ?? 'Tool';
    return [`${label}: ${missing.join(', ')} path parameter${missing.length === 1 ? '' : 's'} should map to path.`];
  });
}

export function validateToolMetadataInputs(tools: ToolMetadataCarrier[]): string[] {
  const errors: string[] = [];
  const names = new Map<string, string>();

  for (const tool of tools) {
    const label = firstString(tool.name, tool.endpoint) ?? 'Tool';
    const name = firstString(tool.name);
    if (!name) {
      errors.push(`${label}: tool name is required.`);
    } else {
      const key = name.toLowerCase();
      const previous = names.get(key);
      if (previous) errors.push(`${label}: tool name duplicates ${previous}.`);
      else names.set(key, label);
    }

    const weight = numberOrUndefined(tool.semanticWeight);
    if (weight !== undefined && (weight < 0 || weight > 10)) {
      errors.push(`${label}: semantic weight must be between 0 and 10.`);
    }

    for (const [field, value] of [['estimated latency', tool.estimatedLatencyMs], ['cache TTL', tool.cacheTtlSeconds]] as const) {
      const number = numberOrUndefined(value);
      if (number !== undefined && (!Number.isInteger(number) || number < 0)) {
        errors.push(`${label}: ${field} must be a non-negative integer.`);
      }
    }

    for (const [parameter, location] of Object.entries(stringRecord(tool.parameterMappings))) {
      if (!PARAMETER_LOCATION_VALUES.includes(location as typeof PARAMETER_LOCATION_VALUES[number])) {
        errors.push(`${label}: ${parameter} has unsupported parameter location ${location}.`);
      }
    }
  }

  return errors;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 0;
}

export function validateTargetHost(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'Target Host must be a valid URL.';
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return 'Target Host must use http or https.';
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === 'metadata.google.internal'
    || hostname === '::1'
    || hostname.startsWith('fe80:')
    || isPrivateIpv4(hostname)
  ) {
    return 'Target Host cannot point to localhost, private, link-local, or metadata addresses.';
  }

  return null;
}
