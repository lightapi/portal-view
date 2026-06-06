import { apiPost } from '../../../api/apiPost';
import fetchClient from '../../../utils/fetchClient';
import { scopeById, type ConfigUpdateScopeId } from './configUpdateScopes';
import type { ConfigSchemaRef, ConfigTargetOption, ConfigUpdateFilters, ConfigUpdateProperty, ConfigUpdateResponse, ConfigUpdateTarget } from './types';

type FetchConfigUpdatePropertiesArgs = {
  hostId: string;
  scope: ConfigUpdateScopeId;
  target: ConfigUpdateTarget;
  filters: ConfigUpdateFilters;
  offset: number;
  limit: number;
  overriddenOnly: boolean;
};

export async function fetchConfigUpdateProperties(args: FetchConfigUpdatePropertiesArgs): Promise<ConfigUpdateResponse> {
  const cmd = {
    host: 'lightapi.net',
    service: 'config',
    action: 'getConfigUpdateProperties',
    version: '0.1.0',
    data: {
      hostId: args.hostId,
      scope: args.scope,
      target: args.target,
      filters: args.filters,
      offset: args.offset,
      limit: args.limit,
      active: true,
      overriddenOnly: args.overriddenOnly,
    },
  };

  return fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
}

export async function getFreshOverride(row: ConfigUpdateProperty) {
  const scope = scopeById[row.scope];
  if (!scope || !row.overrideAggregateVersion) return null;

  const cmd = {
    host: 'lightapi.net',
    service: 'config',
    action: scope.getFreshAction,
    version: '0.1.0',
    data: {
      ...targetPayload(row),
      configId: row.configId,
      propertyId: row.propertyId,
      aggregateVersion: row.overrideAggregateVersion,
    },
  };

  return fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
}

export async function applyConfigUpdate(row: ConfigUpdateProperty, operation: 'create' | 'update' | 'reset', propertyValue?: string) {
  const scope = scopeById[row.scope];
  const action = operation === 'reset'
    ? scope.deleteAction
    : operation === 'create'
      ? scope.createAction
      : scope.updateAction;

  const cmd = {
    host: 'lightapi.net',
    service: 'config',
    action,
    version: '0.1.0',
    data: {
      ...targetPayload(row),
      configId: row.configId,
      propertyId: row.propertyId,
      ...(operation === 'reset' ? {} : { propertyValue: propertyValue ?? '' }),
      ...(row.overrideAggregateVersion ? { aggregateVersion: row.overrideAggregateVersion } : {}),
    },
  };

  const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
  if (result.error) throw result.error;
  return result.data;
}

const schemaCache = new Map<string, Promise<ConfigSchemaRef | null>>();

export async function fetchSchemaByRef(row: ConfigUpdateProperty): Promise<ConfigSchemaRef | null> {
  if (!row.schemaId || !row.schemaVersion || row.schemaStatus !== 'P') return null;
  const cacheKey = `${row.hostId || 'global'}:${row.schemaId}:${row.schemaVersion}`;
  const cached = schemaCache.get(cacheKey);
  if (cached) return cached;

  const promise = fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
    host: 'lightapi.net',
    service: 'schema',
    action: 'getSchemaByRef',
    version: '0.1.0',
    data: {
      hostId: row.hostId,
      schemaId: row.schemaId,
      schemaVersion: row.schemaVersion,
      active: true,
    },
  }))).catch((error) => {
    schemaCache.delete(cacheKey);
    throw error;
  });
  schemaCache.set(cacheKey, promise);
  return promise;
}

function labelQuery(service: string, action: string, data?: Record<string, string | undefined>) {
  const cmd = {
    host: 'lightapi.net',
    service,
    action,
    version: '0.1.0',
    ...(data ? { data } : {}),
  };
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
}

function normalizeTargetOption(value: unknown): ConfigTargetOption | null {
  if (typeof value === 'string') return { id: value, label: value };
  if (!value || typeof value !== 'object') return null;

  const objectValue = value as Record<string, unknown>;
  const id = objectValue.id ?? objectValue.value ?? objectValue.code ?? objectValue.key ?? objectValue.name;
  if (id === undefined || id === null) return null;

  const idText = String(id);
  const label = objectValue.label ?? objectValue.name ?? objectValue.displayName ?? objectValue.value ?? objectValue.description ?? idText;
  return { id: idText, label: String(label) };
}

function normalizeTargetOptions(payload: unknown): ConfigTargetOption[] {
  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload as { data?: unknown; options?: unknown; values?: unknown; items?: unknown }).data
        ?? (payload as { options?: unknown }).options
        ?? (payload as { values?: unknown }).values
        ?? (payload as { items?: unknown }).items
      : [];

  if (!Array.isArray(source)) return [];

  const seen = new Set<string>();
  return source
    .map(normalizeTargetOption)
    .filter((option): option is ConfigTargetOption => {
      if (!option || seen.has(option.id)) return false;
      seen.add(option.id);
      return true;
    });
}

export async function fetchEnvironmentOptions(hostId: string) {
  return normalizeTargetOptions(await fetchClient(`/r/data?name=environment&host=${encodeURIComponent(hostId)}`));
}

export async function fetchProductOptions(hostId: string) {
  return normalizeTargetOptions(await fetchClient(labelQuery('product', 'getProductIdLabel', { hostId })));
}

export async function fetchProductVersionOptions(hostId: string) {
  return normalizeTargetOptions(await fetchClient(labelQuery('product', 'getProductVersionIdLabel', { hostId })));
}

export async function fetchInstanceOptions(hostId: string) {
  return normalizeTargetOptions(await fetchClient(labelQuery('instance', 'getInstanceLabel', { hostId })));
}

export async function fetchInstanceApiOptions(hostId: string, instanceId: string) {
  return normalizeTargetOptions(await fetchClient(labelQuery('instance', 'getInstanceApiLabel', { hostId, instanceId })));
}

export async function fetchInstanceAppOptions(hostId: string, instanceId: string) {
  return normalizeTargetOptions(await fetchClient(labelQuery('instance', 'getInstanceAppLabel', { hostId, instanceId })));
}

export function targetPayload(row: Pick<ConfigUpdateProperty, 'hostId' | 'environment' | 'productId' | 'productVersionId' | 'instanceId' | 'instanceApiId' | 'instanceAppId' | 'scope'>) {
  const payload: Record<string, string | undefined> = {};
  if (row.scope !== 'product') payload.hostId = row.hostId;
  if (row.scope === 'environment') payload.environment = row.environment;
  if (row.scope === 'product') payload.productId = row.productId;
  if (row.scope === 'productVersion') payload.productVersionId = row.productVersionId;
  if (row.scope === 'instance') payload.instanceId = row.instanceId;
  if (row.scope === 'api') payload.instanceApiId = row.instanceApiId;
  if (row.scope === 'app') payload.instanceAppId = row.instanceAppId;
  if (row.scope === 'appApi') {
    payload.instanceAppId = row.instanceAppId;
    payload.instanceApiId = row.instanceApiId;
  }
  return payload;
}
