import { useEffect } from 'react';
import fetchClient from '../../../utils/fetchClient';
import type { McpWizardState } from './useMcpWizardState';

/**
 * Handles two prefill side-effects:
 * 1. URL params (?apiId, ?apiVersionId, ?instanceApiId) → fetches API + version data to
 *    populate form tabs when the wizard is opened from the MCP Servers list.
 * 2. creationType === 'server' → pre-seeds apiType + transportConfig on the version form.
 */
export function useMcpPrefill(state: McpWizardState) {
  const {
    host,
    preApiId, preApiVersionId, preInstanceApiId,
    patch, patchVersion,
    setApiAggregateVersion, setVersionAggregateVersion,
    setSelectedInstanceId, setCommittedApiVersionId,
    creationType, versionForm,
  } = state;

  useEffect(() => {
    if (!host) return;
    if (!preApiId && !preInstanceApiId && !preApiVersionId) return;

    const fetchPrefill = async () => {
      let resolvedApiId = preApiId;
      let resolvedApiVersionId = preApiVersionId;

      if (preInstanceApiId) {
        try {
          const filters = JSON.stringify([{ id: 'instanceApiId', value: preInstanceApiId }]);
          const cmd = {
            host: 'lightapi.net', service: 'instance', action: 'getInstanceApi', version: '0.1.0',
            data: { hostId: host, offset: 0, limit: 10, active: true, filters, sorting: '[]', globalFilter: '' },
          };
          const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
          const ia = (data?.instanceApis ?? [])[0];
          if (ia) {
            if (!resolvedApiId) resolvedApiId = ia.apiId ?? '';
            if (!resolvedApiVersionId) resolvedApiVersionId = ia.apiVersionId ?? '';
            if (ia.instanceId) setSelectedInstanceId(ia.instanceId);
            if (resolvedApiVersionId) setCommittedApiVersionId(resolvedApiVersionId);
          }
        } catch { /* non-fatal */ }
      }

      if (!resolvedApiId) return;

      try {
        const cmd = {
          host: 'lightapi.net', service: 'service', action: 'getApi', version: '0.1.0',
          data: { hostId: host, offset: 0, limit: 10, active: true,
            filters: JSON.stringify([{ id: 'apiId', value: resolvedApiId }]), sorting: '[]', globalFilter: '' },
        };
        const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
        const api = (data?.services ?? [])[0];
        if (api) {
          patch({
            apiId: api.apiId ?? resolvedApiId,
            ...(api.apiName && { apiName: api.apiName }),
            ...(api.apiDesc && { apiDesc: api.apiDesc }),
            ...(api.operationOwner && { operationOwner: api.operationOwner }),
            ...(api.deliveryOwner && { deliveryOwner: api.deliveryOwner }),
            ...(api.region && { region: api.region }),
            ...(api.businessGroup && { businessGroup: api.businessGroup }),
            ...(api.lob && { lob: api.lob }),
            ...(api.platform && { platform: api.platform }),
            ...(api.capability && { capability: api.capability }),
            ...(api.gitRepo && { gitRepo: api.gitRepo }),
            ...(api.apiStatus && { apiStatus: api.apiStatus }),
            ...(api.apiTags && { apiTags: typeof api.apiTags === 'string' ? api.apiTags.split(',') : api.apiTags }),
          });
          if (api.aggregateVersion) setApiAggregateVersion(api.aggregateVersion);
        }
      } catch { /* non-fatal */ }

      if (!resolvedApiVersionId) return;

      try {
        const cmd = {
          host: 'lightapi.net', service: 'service', action: 'getApiVersion', version: '0.1.0',
          data: { hostId: host, apiId: resolvedApiId, offset: 0, limit: 100, active: true, sorting: '[]', filters: '[]', globalFilter: '' },
        };
        const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
        const versions: any[] = Array.isArray(data) ? data : (data?.apiVersions ?? []);
        const ver = versions.find((v) => v.apiVersionId === resolvedApiVersionId) ?? versions[0];
        if (ver) {
          patchVersion({
            ...(ver.apiVersion && { apiVersion: ver.apiVersion }),
            ...(ver.apiType && { apiType: ver.apiType }),
            ...(ver.serviceId && { serviceId: ver.serviceId }),
            ...(ver.apiVersionDesc && { apiVersionDesc: ver.apiVersionDesc }),
            ...(ver.specLink && { specLink: ver.specLink }),
            ...(ver.spec && { spec: ver.spec }),
            ...(ver.transportConfig && { transportConfig: ver.transportConfig }),
            ...(ver.protocol && { protocol: ver.protocol }),
            ...(ver.envTag && { envTag: ver.envTag }),
            ...(ver.targetHost && { targetHost: ver.targetHost }),
          });
          if (ver.aggregateVersion) setVersionAggregateVersion(ver.aggregateVersion);
        }
      } catch { /* non-fatal */ }
    };

    fetchPrefill();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preApiId, preApiVersionId, preInstanceApiId, host]);

  // Pre-fill apiType='mcp' and default transportConfig when wizard type is 'server'
  useEffect(() => {
    if (creationType === 'server' && !versionForm.apiType) {
      patchVersion({
        apiType: 'mcp',
        transportConfig: '{"transport": "streamable http", "url": "https://lightapi.net/mcp"}',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creationType]);
}
