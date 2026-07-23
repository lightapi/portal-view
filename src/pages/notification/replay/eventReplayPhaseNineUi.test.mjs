import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canApprove, canExecute, isNotificationMatch, replayProgress, selectedAndAdded } from './workflow.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(here, name), 'utf8');

const items = [
  { failureId: 'selected', addedDependency: false, status: 'SUCCEEDED' },
  { failureId: 'prerequisite', addedDependency: true, status: 'RUNNING' },
];
assert.deepEqual(selectedAndAdded(items).selected.map((item) => item.failureId), ['selected']);
assert.deepEqual(selectedAndAdded(items).added.map((item) => item.failureId), ['prerequisite']);
assert.deepEqual(replayProgress(items), { complete: 1, total: 2, percent: 50 });

assert.equal(canApprove('AWAITING_APPROVAL', false, 'requester', 'approver'), true);
assert.equal(canApprove('AWAITING_APPROVAL', false, 'same-person', 'same-person'), false);
assert.equal(canApprove('AWAITING_APPROVAL', true, 'requester', 'approver'), false);
assert.equal(canExecute('APPROVED', false, 'EXECUTE', 'approver', 'sha256:abc', 'sha256:abc'), true);
assert.equal(canExecute('APPROVED', false, 'EXECUTE', 'approver', 'sha256:abc', 'sha256:different'), false);
assert.equal(canExecute('APPROVED', false, 'VALIDATE_ONLY', 'approver', 'sha256:abc', 'sha256:abc'), false);
assert.equal(isNotificationMatch({ originalTransactionId: 'tx-18' }, ['tx-18']), true);

const admin = read('EventReplayAdmin.tsx');
assert.match(admin, /replayRequestId/);
assert.match(admin, /setInterval\([^,]+, 3000\)/s);
assert.doesNotMatch(admin, /Replay All/i);
assert.doesNotMatch(admin, /console\.(log|error|warn)/);

const quarantine = read('ReplayQuarantinePanel.tsx');
assert.match(quarantine, /RELEASE_WITH_GAP/);
assert.match(quarantine, /is not a repair/);
assert.match(quarantine, /failureId/);
assert.match(quarantine, /requestedBy === currentUserId/);
const waiver = read('ReplayWaiverPanel.tsx');
assert.match(waiver, /requestedBy === currentUserId/);
assert.match(waiver, /downstreamBlockedFailureIds/);
const status = read('ReplayStatusPanel.tsx');
assert.match(status, /STALE PLAN/);
assert.match(status, /failureCode/);
assert.match(status, /Dependency added/);
const candidates = read('ReplayCandidateTable.tsx');
assert.match(candidates, /No open canonical replay candidates found/);
assert.match(candidates, /legacy DLQ notification.*captured or backfilled as a complete failure transaction/s);

for (const file of ['api.ts', 'ReplayCandidateTable.tsx', 'ReplayStatusPanel.tsx', 'ReplayAttemptTimeline.tsx']) {
  const source = read(file);
  assert.doesNotMatch(source, /payloadCiphertext|sourceHeaders|sourceKey|eventJson/, `${file} exposes prohibited replay data`);
  assert.doesNotMatch(source, /console\.(log|error|warn)/, `${file} logs replay data`);
}

console.log('Phase 9 UI workflow tests passed.');
