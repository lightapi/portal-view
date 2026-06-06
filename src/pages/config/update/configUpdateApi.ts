import { apiPost } from '../../../api/apiPost';
import fetchClient from '../../../utils/fetchClient';
import { scopeById, type ConfigUpdateScopeId } from './configUpdateScopes';
import type { ConfigUpdateFilters, ConfigUpdateProperty, ConfigUpdateResponse, ConfigUpdateTarget } from './types';

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

export function targetPayload(row: Pick<ConfigUpdateProperty, 'hostId' | 'instanceId' | 'instanceApiId' | 'instanceAppId' | 'scope'>) {
  const payload: Record<string, string | undefined> = { hostId: row.hostId };
  if (row.scope === 'instance') payload.instanceId = row.instanceId;
  if (row.scope === 'api') payload.instanceApiId = row.instanceApiId;
  if (row.scope === 'app') payload.instanceAppId = row.instanceAppId;
  if (row.scope === 'appApi') {
    payload.instanceAppId = row.instanceAppId;
    payload.instanceApiId = row.instanceApiId;
  }
  return payload;
}
