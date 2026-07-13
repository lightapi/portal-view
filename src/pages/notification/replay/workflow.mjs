export const terminalReplayStatuses = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']);

export function selectedAndAdded(items = []) {
  return {
    selected: items.filter((item) => !item.addedDependency),
    added: items.filter((item) => item.addedDependency),
  };
}

export function canApprove(status, stale, requester, currentUser) {
  return status === 'AWAITING_APPROVAL' && !stale && !!currentUser && requester !== currentUser;
}

export function canExecute(status, stale, validationMode, approvedBy, planHash, confirmedHash) {
  return status === 'APPROVED' && !stale && validationMode !== 'VALIDATE_ONLY'
    && !!approvedBy && planHash === confirmedHash;
}

export function replayProgress(items = []) {
  const complete = items.filter((item) => item.status === 'SUCCEEDED').length;
  return { complete, total: items.length, percent: items.length ? Math.round(complete * 100 / items.length) : 0 };
}

export function isNotificationMatch(failure, transactionIds = []) {
  return !!failure?.originalTransactionId && transactionIds.includes(failure.originalTransactionId);
}

