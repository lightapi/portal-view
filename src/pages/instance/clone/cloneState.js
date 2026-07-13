const TERMINAL_STATUSES = new Set(['PROJECTED', 'SNAPSHOT_READY', 'FAILED_DLQ']);

export function isAbortError(error) {
  return Boolean(error && typeof error === 'object' && (error.name === 'AbortError' || error.code === 20));
}

export function cloneErrorText(error) {
  if (error && typeof error === 'object') {
    if (typeof error.code === 'string' && error.code) return error.code;
    if (typeof error.message === 'string' && error.message) return error.message;
    if (typeof error.description === 'string' && error.description) return error.description;
    return 'Request failed.';
  }
  return typeof error === 'string' ? error : 'Request failed.';
}

export function normalizeCloneOptions(payload) {
  const source = Array.isArray(payload) ? payload
    : payload && typeof payload === 'object' ? payload.data ?? payload.options ?? payload.values ?? payload.items ?? [] : [];
  if (!Array.isArray(source)) return [];
  const seen = new Set();
  return source.flatMap((value) => {
    if (typeof value === 'string') return seen.has(value) ? [] : (seen.add(value), [{ id: value, label: value }]);
    if (!value || typeof value !== 'object') return [];
    const rawId = value.id ?? value.value ?? value.code ?? value.key ?? value.name;
    if (rawId == null) return [];
    const id = String(rawId);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, label: String(value.label ?? value.name ?? value.displayName ?? value.value ?? value.description ?? id) }];
  });
}

export function includeOriginalOption(options, original) {
  if (!original || options.some((option) => option.id === original)) return options;
  return [{ id: original, label: original }, ...options];
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function cloneFormFingerprint(form) {
  const { revealedValues: _revealedValues, ...safeForm } = form;
  return stableStringify(safeForm);
}

export function propertySelectionKey(selection) {
  return stableStringify({
    scopeType: selection.scopeType,
    sourceParentIds: selection.sourceParentIds,
    propertyId: selection.propertyId,
    expectedAggregateVersion: selection.expectedAggregateVersion,
  });
}

export function mergePlannedSelections(currentSelections, plannedSelections) {
  const currentByKey = new Map((currentSelections ?? []).map((selection) => [propertySelectionKey(selection), selection]));
  return (plannedSelections ?? []).map((selection) => {
    const current = currentByKey.get(propertySelectionKey(selection));
    if (selection.action !== 'REPLACE' || current?.action !== 'REPLACE') return selection;
    return { ...selection, replacementValue: current.replacementValue ?? null };
  });
}

export function nextPollingDelay(attempt, random = Math.random) {
  const base = attempt < 3 ? [1000, 2000, 4000][attempt] : 5000;
  const capped = Math.min(5000, base);
  const jitter = Math.round(capped * 0.1 * ((random() * 2) - 1));
  return Math.max(500, Math.min(5000, capped + jitter));
}

export function isTerminalCloneStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

export function shouldPollClone({ status, visible, online, inFlight }) {
  return status === 'ACCEPTED' && visible && online && !inFlight;
}

export function selectedEntityIds(rows, entityType) {
  const prefix = `${entityType}:`;
  return (rows ?? [])
    .map((row) => row.selector)
    .filter((selector) => typeof selector === 'string' && selector.startsWith(prefix))
    .map((selector) => selector.slice(prefix.length));
}
