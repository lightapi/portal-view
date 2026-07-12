import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cloneFormFingerprint,
  isTerminalCloneStatus,
  nextPollingDelay,
  propertySelectionKey,
  selectedEntityIds,
  shouldPollClone,
} from './cloneState.js';

test('fingerprint is deterministic and ignores revealed values', () => {
  const first = cloneFormFingerprint({ target: { name: 'demo', env: 'demo' }, revealedValues: { a: 'secret' } });
  const second = cloneFormFingerprint({ revealedValues: {}, target: { env: 'demo', name: 'demo' } });
  assert.equal(first, second);
});

test('stable property key does not contain replacement values', () => {
  const key = propertySelectionKey({ scopeType: 'INSTANCE', sourceParentIds: { instanceId: 'i' }, propertyId: 'p', expectedAggregateVersion: 2, replacementValue: 'secret' });
  assert.doesNotMatch(key, /secret/);
});

test('poll delay backs off, jitters, and stays capped', () => {
  assert.equal(nextPollingDelay(0, () => 0.5), 1000);
  assert.equal(nextPollingDelay(1, () => 0.5), 2000);
  assert.equal(nextPollingDelay(2, () => 0.5), 4000);
  assert.equal(nextPollingDelay(20, () => 1), 5000);
  assert.ok(nextPollingDelay(20, () => 0) >= 500);
});

test('polling is single-flight and stops for terminal states', () => {
  assert.equal(shouldPollClone({ status: 'ACCEPTED', visible: true, online: true, inFlight: false }), true);
  assert.equal(shouldPollClone({ status: 'ACCEPTED', visible: true, online: true, inFlight: true }), false);
  assert.equal(shouldPollClone({ status: 'ACCEPTED', visible: false, online: true, inFlight: false }), false);
  for (const status of ['PROJECTED', 'SNAPSHOT_READY', 'FAILED_DLQ']) assert.equal(isTerminalCloneStatus(status), true);
});

test('extracts selectable file and deployment IDs from metadata rows', () => {
  const rows = [{ selector: 'ConfigInstanceFile:file-1' }, { selector: 'DeploymentInstance:dep-1' }, { selector: 'INSTANCE:ignored' }];
  assert.deepEqual(selectedEntityIds(rows, 'ConfigInstanceFile'), ['file-1']);
  assert.deepEqual(selectedEntityIds(rows, 'DeploymentInstance'), ['dep-1']);
});
