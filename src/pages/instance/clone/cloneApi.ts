import fetchClient from '../../../utils/fetchClient';
import { normalizeCloneOptions } from './cloneState.js';
import type { CloneExecution, CloneOption, ClonePlan, CloneStatusResult, CloneTargetOptions, PropertySelection, SourceInstance } from './types';

function rpc(action: string, data: Record<string, unknown>) {
  return { host: 'lightapi.net', service: 'instance', action, version: '0.1.0', data };
}

export function fetchFreshSource(source: SourceInstance, signal?: AbortSignal): Promise<SourceInstance> {
  return fetchClient('/portal/query', {
    method: 'POST', signal,
    body: rpc('getFreshInstance', {
      hostId: source.hostId,
      instanceId: source.instanceId,
      aggregateVersion: source.aggregateVersion ?? 0,
    }),
  });
}

function labelQuery(service: string, action: string, data: Record<string, string>) {
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
    host: 'lightapi.net', service, action, version: '0.1.0', data,
  }));
}

async function optionRequest(url: string, signal?: AbortSignal): Promise<CloneOption[]> {
  return normalizeCloneOptions(await fetchClient(url, { signal }));
}

export async function fetchCloneTargetOptions(hostId: string, signal?: AbortSignal): Promise<CloneTargetOptions> {
  const requests = [
    optionRequest(labelQuery('product', 'getProductVersionIdLabel', { hostId }), signal),
    optionRequest(`/r/data?name=environment&host=${encodeURIComponent(hostId)}`, signal),
    optionRequest('/r/data?name=environment', signal),
    optionRequest(`/r/data?name=network_zone&host=${encodeURIComponent(hostId)}`, signal),
    optionRequest(`/r/data?name=region&host=${encodeURIComponent(hostId)}`, signal),
    optionRequest(`/r/data?name=lob&host=${encodeURIComponent(hostId)}`, signal),
  ];
  const results = await Promise.allSettled(requests);
  const value = (index: number) => results[index].status === 'fulfilled' ? results[index].value : [];
  return { productVersionId: value(0), envTag: value(1), environment: value(2), zone: value(3), region: value(4), lob: value(5) };
}

export function planInstanceClone(data: Record<string, unknown>, signal?: AbortSignal): Promise<ClonePlan> {
  return fetchClient('/portal/query', { method: 'POST', signal, body: rpc('planInstanceClone', data) });
}

export function revealInstanceCloneValue(data: {
  hostId: string;
  cloneRequestId: string;
  sourceInstanceId: string;
  sourceGraphDigest: string;
  selector: PropertySelection;
}, signal?: AbortSignal): Promise<{ selector: string; valueType: string; value: string }> {
  const { action: _action, replacementValue: _replacementValue, ...selector } = data.selector;
  return fetchClient('/portal/query', { method: 'POST', signal, body: rpc('revealInstanceCloneValue', { ...data, selector }) });
}

export function executeInstanceClone(data: Record<string, unknown>, signal?: AbortSignal): Promise<CloneExecution> {
  return fetchClient('/portal/command', { method: 'POST', signal, body: rpc('cloneInstance', data) });
}

export function getInstanceCloneStatus(hostId: string, cloneRequestId: string, signal?: AbortSignal): Promise<CloneStatusResult> {
  return fetchClient('/portal/query', { method: 'POST', signal, body: rpc('getInstanceCloneStatus', { hostId, cloneRequestId }) });
}
