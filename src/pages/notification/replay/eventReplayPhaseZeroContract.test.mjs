import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'));

const contract = fixture('event-replay-contract-v1.json');
const api = fixture('event-replay-api-v1.json');
const authorization = fixture('event-replay-authorization-v1.json');

test('Phase 0 keeps replay operations in the user namespace and all gates disabled', () => {
  assert.equal(contract.contractVersion, 'event-replay-v1');
  assert.equal(contract.apiNamespace, 'lightapi.net/user');
  assert.equal(contract.operations.length, 9);
  assert.ok(contract.operations.every(({ serviceId }) => serviceId.startsWith('lightapi.net/user/') && serviceId.endsWith('/0.1.0')));
  assert.ok(contract.operations.some(({ name }) => name === 'waiveEventReplayFailure'));
  assert.ok(Object.values(contract.featureGates).every((enabled) => enabled === false));
});

test('Phase 0 API examples cover every operation without returning decrypted payloads', () => {
  const operations = contract.operations.map(({ name }) => name).sort();
  const examples = api.examples.map(({ operation }) => operation).sort();
  assert.deepEqual(examples, operations);
  assert.ok(api.examples.every(({ request, response }) => request && response));
  assert.doesNotMatch(JSON.stringify(api), /payloadCiphertext|decryptedPayload|payloadPlaintext/i);

  const waiver = api.examples.find(({ operation }) => operation === 'waiveEventReplayFailure');
  assert.equal(waiver.request.acknowledgeDependencyImpact, true);
  assert.equal(waiver.response.projectionMetadataAdvanced, false);
});

test('Phase 0 authorization decisions reject substring roles, cross-host access, and self approval', () => {
  const decision = (id) => authorization.decisionCases.find((entry) => entry.id === id);
  assert.equal(authorization.roleTokenPattern, '[,\\s]+');
  assert.equal(decision('substring-role-denied').expected, 'DENY');
  assert.equal(decision('cross-host-denied').expected, 'DENY');
  assert.equal(decision('self-approval-denied').expected, 'DENY');
  assert.equal(decision('client-credentials-human-command-denied').expected, 'DENY');
  assert.equal(decision('trusted-worker-may-run-worker-only').expected, 'ALLOW');
  assert.equal(authorization.rules.uiRoleCheckIsSecurityBoundary, false);
});
