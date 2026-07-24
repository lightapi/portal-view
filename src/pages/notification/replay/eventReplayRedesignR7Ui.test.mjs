import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(here, name), 'utf8');
const forms = JSON.parse(readFileSync(resolve(here, '../../../data/Forms.json'), 'utf8'));
const policy = JSON.parse(read('__fixtures__/event-replay-policy-v2.json'));
const fixtureForm = forms.eventReplayUserUpdatedRepair;
const fixturePolicy = policy.deployedEventPolicies.find((entry) => entry.eventType === 'UserUpdatedEvent');

assert.equal(fixtureForm.eventType, fixturePolicy.eventType);
assert.equal(fixtureForm.eventSchemaVersion, fixturePolicy.schemaVersion);
assert.equal(fixtureForm.repairSchemaVersion, fixturePolicy.repairSchema.schemaVersion);
assert.deepEqual(Object.keys(fixtureForm.schema.properties),
  fixturePolicy.repairSchema.editableFields.map((field) => field.jsonPointer.split('/').at(-1)));
assert.equal(fixtureForm.schema.additionalProperties, false);

const api = read('api.ts');
for (const action of ['createEventReplayRepair', 'getEventReplayRepair', 'approveEventReplayRepair']) {
  assert.ok(api.includes(action), `missing R7 API action ${action}`);
}
for (const code of ['AGGREGATE_PROJECTION_BLOCKED', 'AGGREGATE_REPAIR_REQUIRED',
  'EVENT_REPAIR_REQUIRED', 'REPLAY_EXECUTION_PAUSED']) assert.ok(api.includes(code));

const panel = read('ReplayRepairPanel.tsx');
for (const evidence of ['SchemaForm', 'SINGLE_EVENT_FIELDS', 'PER_EVENT_FIELDS',
  'Create repair proposal', 'Approve repair', 'Reject repair', 'Plan approved repair',
  'different authorized user', 'requires its own approval', 'Corrected payload values are intentionally not returned']) {
  assert.ok(panel.includes(evidence), `missing R7 panel evidence: ${evidence}`);
}
assert.doesNotMatch(panel, /JSONEditor|CodeMirror|eventJson|sourceKey|sourceHeaders|payloadCiphertext/);
assert.doesNotMatch(panel, /hasAnyRole|admin|host-admin|user-admin|event-replay-operator|event-replay-approver/i);
assert.match(panel, /if \(!repair\) return;[\s\S]*setModels\(\{\}\)/);
assert.match(read('repairForms.ts'), /if \(matches\.length !== 1\) return null/);

const admin = read('EventReplayAdmin.tsx');
assert.match(admin, />Replay original</);
assert.match(admin, />Repair</);
assert.match(admin, /repairId=|searchParams\.set\('repairId'/);
assert.match(admin, /portal:event-replay-applied/);
assert.match(admin, /onProjectionRefresh/);
assert.match(admin, /planningRepairId \|\| undefined/);

const status = read('ReplayStatusPanel.tsx');
assert.match(status, /REPAIR_FINGERPRINT_MISMATCH/);
assert.match(status, /STALE_PLAN/);
assert.match(status, /Bound repair status/);

console.log('Event replay redesign R7 UI gate passed: schema-only repair, independent approvals, repair-bound planning, safe metadata, and refresh.');
