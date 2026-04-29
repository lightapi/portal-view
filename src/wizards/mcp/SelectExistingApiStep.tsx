import { useState, useEffect, useCallback } from 'react';
import { Stack } from '@mui/material';
import fetchClient from '../../utils/fetchClient';
import ApiPickerList from './lists/ApiPickerList';
import { SearchSortBar } from './SearchSortBar';
import type { PickerVersionRow, PickerApiRow, PickerMcpState } from './listTypes';

export interface ExistingApiSelection {
  apiId: string;
  apiName?: string;
  apiDesc?: string;
  apiVersionId?: string;
  apiVersion?: string;
  instanceApiId?: string;
  distributedInstanceIds?: string[];  // non-lg instanceIds for the selected version
  mcpState?: PickerMcpState;
}

interface Props {
  host: string;
  selection: ExistingApiSelection | null;
  onChange: (s: ExistingApiSelection) => void;
  mode?: 'existing-api' | 'gateway-onboard';
}

export default function SelectExistingApiStep({ host, selection, onChange, mode = 'existing-api' }: Props) {
  const [apis, setApis] = useState<PickerApiRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pendingMcpCount, setPendingMcpCount] = useState(0);

  const load = useCallback(async () => {
    if (!host) return;
    setIsLoading(true);
    setError(null);
    try {
      const EXCLUDED_PRODUCT_IDS = new Set(['lg', 'lpc', 'lb']);

      // 1. Fetch all instances and determine qualifying instanceIds
      const instCmd = {
        host: 'lightapi.net', service: 'instance', action: 'getInstance', version: '0.1.0',
        data: { hostId: host, offset: 0, limit: 1000, active: true, sorting: '[]', filters: '[]', globalFilter: '' },
      };
      const instData = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(instCmd)));
      const allInstances: any[] = instData?.instances ?? [];

      const qualifyingInstanceIds = new Set(
        allInstances
          .filter((inst: any) =>
            mode === 'existing-api'
              ? !EXCLUDED_PRODUCT_IDS.has((inst.productId ?? '').toLowerCase())
              : true
          )
          .map((inst: any) => inst.instanceId)
          .filter(Boolean),
      );

      // 2. Fetch instanceApis + full API list in parallel
      const [iaData, apiData] = await Promise.all([
        fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
          host: 'lightapi.net', service: 'instance', action: 'getInstanceApi', version: '0.1.0',
          data: { hostId: host, offset: 0, limit: 1000, active: true, sorting: '[]', globalFilter: '', filters: '[]' },
        }))),
        mode === 'existing-api'
          ? fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
              host: 'lightapi.net', service: 'service', action: 'getApi', version: '0.1.0',
              data: { hostId: host, offset: 0, limit: 1000, active: true, filters: '[]', sorting: '[]', globalFilter: '' },
            })))
          : Promise.resolve(null),
      ]);

      const allInstanceApis: any[] = iaData?.instanceApis ?? [];
      const allApis: any[] = apiData?.services ?? [];

      const qualifyingInstanceApis = allInstanceApis.filter(
        (ia: any) => ia.instanceId && qualifyingInstanceIds.has(ia.instanceId),
      );

      // 3. Group by apiId → apiVersionId, keeping first qualifying instanceApi per version
      const apiMeta = new Map<string, { apiName?: string; apiDesc?: string }>();
      const versionsByApi = new Map<string, Map<string, PickerVersionRow>>();

      for (const ia of qualifyingInstanceApis) {
        if (!ia.apiId || !ia.apiVersionId || !ia.instanceApiId) continue;
        if (!apiMeta.has(ia.apiId)) apiMeta.set(ia.apiId, { apiName: ia.apiName });
        if (!versionsByApi.has(ia.apiId)) versionsByApi.set(ia.apiId, new Map());
        const verMap = versionsByApi.get(ia.apiId)!;
        if (!verMap.has(ia.apiVersionId)) {
          verMap.set(ia.apiVersionId, {
            apiVersionId: ia.apiVersionId,
            apiVersion: ia.apiVersion,
            instanceApiId: ia.instanceApiId,
            instanceName: ia.instanceName ?? ia.instanceId,
            distributedInstanceIds: ia.instanceId ? [ia.instanceId] : [],
            mcpState: undefined,
          });
        } else if (ia.instanceId) {
          const row = verMap.get(ia.apiVersionId)!;
          if (!row.distributedInstanceIds?.includes(ia.instanceId)) {
            row.distributedInstanceIds = [...(row.distributedInstanceIds ?? []), ia.instanceId];
          }
        }
      }

      // 4. For existing-api mode, also include registry-only APIs (no qualifying instance)
      //    Fetch their versions so the picker can show them (no instanceApiId on these rows)
      if (mode === 'existing-api') {
        const registryOnlyApis = allApis.filter((a: any) => a.apiId && !apiMeta.has(a.apiId));
        for (const a of registryOnlyApis) {
          apiMeta.set(a.apiId, { apiName: a.apiName, apiDesc: a.apiDesc });
        }
        await Promise.all(registryOnlyApis.map(async (a: any) => {
          try {
            const verData = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
              host: 'lightapi.net', service: 'service', action: 'getApiVersion', version: '0.1.0',
              data: { hostId: host, apiId: a.apiId, offset: 0, limit: 100, active: true, sorting: '[]', filters: '[]', globalFilter: '' },
            })));
            const vers: any[] = Array.isArray(verData) ? verData : (verData?.apiVersions ?? []);
            if (vers.length > 0) {
              versionsByApi.set(a.apiId, new Map(
                vers.map((v: any) => [v.apiVersionId, {
                  apiVersionId: v.apiVersionId,
                  apiVersion: v.apiVersion,
                  instanceApiId: undefined,
                  instanceName: undefined,
                  mcpState: undefined,
                }])
              ));
            }
          } catch { /* non-fatal */ }
        }));
      }

      const entries: PickerApiRow[] = Array.from(apiMeta.entries()).map(([apiId, meta]) => ({
        apiId,
        apiName: meta.apiName,
        apiDesc: meta.apiDesc,
        versions: Array.from((versionsByApi.get(apiId) ?? new Map()).values())
          .sort((a, b) => b.apiVersion.localeCompare(a.apiVersion)),
      }));

      const linkedVersions = entries.flatMap((e) => (e.versions ?? []).filter((v) => v.instanceApiId));
      setPendingMcpCount(linkedVersions.length);

      if (linkedVersions.length === 0) { setApis(entries); setPendingMcpCount(0); return; }

      setApis(entries);
      for (const entry of entries) {
        for (const ver of (entry.versions ?? [])) {
          if (!ver.instanceApiId) continue;
          const mcpCmd = {
            host: 'lightapi.net', service: 'instance', action: 'getInstanceApiMcpTool', version: '0.1.0',
            data: { hostId: host, instanceApiId: ver.instanceApiId, apiVersionId: ver.apiVersionId },
          };
          fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(mcpCmd)))
            .then((mcpData: any) => {
              const exists: boolean = mcpData?.exists ?? false;
              const sel: any[] = (mcpData?.endpoints ?? []).filter((e: any) => e.selected);
              const state: PickerMcpState = !exists ? 'unconfigured' : sel.length === 0 ? 'no-tools' : 'ready';
              setApis((prev) =>
                prev.map((e) =>
                  e.apiId !== entry.apiId ? e : {
                    ...e,
                    versions: (e.versions ?? []).map((v) =>
                      v.apiVersionId === ver.apiVersionId ? { ...v, mcpState: state } : v
                    ),
                  }
                )
              );
              setPendingMcpCount((n) => Math.max(0, n - 1));
            })
            .catch(() => { setPendingMcpCount((n) => Math.max(0, n - 1)); });
        }
      }
    } catch {
      setError('Failed to load APIs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [host, mode]);

  useEffect(() => { load(); }, [load]);

  const mcpResolved = pendingMcpCount === 0 && !isLoading;

  return (
    <Stack spacing={2}>
      <SearchSortBar
        filter={q}
        onFilterChange={setQ}
        placeholder="Search APIs…"
      />
      <ApiPickerList
        apis={apis}
        selection={selection}
        onChange={onChange}
        mode={mode}
        mcpResolved={mcpResolved}
        isLoading={isLoading}
        error={error}
        q={q}
      />
    </Stack>
  );
}
