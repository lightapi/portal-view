import type { MRT_RowSelectionState } from 'material-react-table';
import type { InstanceComparisonCandidate } from './instanceCurrentSnapshots.types';

export const MAX_CURRENT_SNAPSHOT_INSTANCES = 4;

export function instanceSelectionKey(instance: Pick<InstanceComparisonCandidate, 'hostId' | 'instanceId'>) {
  return `${instance.hostId}:${instance.instanceId}`;
}

export function instanceComparisonIssue(instances: InstanceComparisonCandidate[]): string | null {
  if (instances.length < 2) return 'Select at least two instances.';
  if (instances.length > MAX_CURRENT_SNAPSHOT_INSTANCES) return 'Select no more than four instances.';
  if (new Set(instances.map(instance => instance.instanceId)).size !== instances.length) {
    return 'Select unique instances.';
  }
  const serviceIds = instances.map(instance => instance.serviceId?.trim()).filter(Boolean) as string[];
  if (serviceIds.length !== instances.length) return 'Every selected instance must have a service id.';
  if (new Set(serviceIds).size !== 1) return 'Selected instances must have the same service id.';
  return null;
}

export function updateSelectedInstances<T extends InstanceComparisonCandidate>(
  current: Map<string, T>,
  pageRows: T[],
  nextSelection: MRT_RowSelectionState,
  max = MAX_CURRENT_SNAPSHOT_INSTANCES,
) {
  const selected = new Map(current);
  let capped = false;
  for (const instance of pageRows) {
    const key = instanceSelectionKey(instance);
    if (!nextSelection[key]) selected.delete(key);
    else if (!selected.has(key)) {
      if (selected.size >= max) capped = true;
      else selected.set(key, instance);
    }
  }
  return { selected, capped };
}
