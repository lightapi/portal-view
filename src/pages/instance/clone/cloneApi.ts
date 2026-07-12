import fetchClient from '../../../utils/fetchClient';
import type { CloneExecution, ClonePlan, CloneStatusResult, PropertySelection, SourceInstance } from './types';

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
