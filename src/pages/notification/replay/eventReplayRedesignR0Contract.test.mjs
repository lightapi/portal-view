import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'));

const contract = fixture('event-replay-contract-v2.json');
const api = fixture('event-replay-api-v2.json');
const authorization = fixture('event-replay-authorization-v2.json');
const policy = fixture('event-replay-policy-v2.json');

test('R0 freezes twelve gateway-authorized replay endpoints', () => {
  assert.equal(contract.contractVersion, 'event-replay-v2');
  assert.equal(contract.compatibleContractVersion, 'event-replay-v1');
  assert.equal(contract.operations.length, 12);
  assert.equal(authorization.endpointPermissionHooks.length, 12);
  assert.equal(authorization.endpointAuthorization.authority, 'light-gateway');
  assert.equal(authorization.endpointAuthorization.roleNamesAreDeploymentDefined, true);
  assert.equal(authorization.rules.backendHardcodedRoleCheck, false);
  assert.ok(contract.operations.some(({ name }) => name === 'getEventReplayRepair'));
  assert.ok(contract.operations.some(({ name }) => name === 'createEventReplayRepair'));
  assert.ok(contract.operations.some(({ name }) => name === 'approveEventReplayRepair'));
});

test('R0 API examples cover all operations and expose no payload material', () => {
  const operations = contract.operations.map(({ name }) => name).sort();
  const examples = api.examples.map(({ operation }) => operation).sort();
  assert.deepEqual(examples, operations);
  assert.ok(api.examples.every(({ request, response }) => request && response));
  assert.doesNotMatch(JSON.stringify(api), /payloadCiphertext|payloadPlaintext|decryptedPayload|originalPayload|correctedPayload/i);

  const create = api.examples.find(({ operation }) => operation === 'createEventReplayRepair');
  assert.ok(create.request.changes);
  assert.equal(create.request.eventJson, undefined);
  assert.equal(create.response.status, 'AWAITING_APPROVAL');
  assert.equal(api.compatibleFixtureVersion, 'event-replay-api-v1');
  assert.match(api.compatibilityRule, /first nine examples equal v1/i);

  const wireDigestValues = JSON.stringify(api).match(/sha256:[0-9a-f]{64}/g) ?? [];
  assert.ok(wireDigestValues.length > 0);
  assert.doesNotMatch(JSON.stringify(api), /"(?:planHash|payloadDigest|contentFingerprint|originalTransactionFingerprint|correctedTransactionFingerprint)":"[0-9a-f]{64}"/);
});

test('R0 separates repair approval from replay-plan approval', () => {
  assert.equal(contract.approvalSeparation.repairApproval.requesterMustDifferFromApprover, true);
  assert.equal(contract.approvalSeparation.replayPlanApproval.requesterMustDifferFromApprover, true);
  assert.equal(contract.approvalSeparation.repairApprovalDoesNotApproveReplayPlan, true);
  assert.equal(contract.approvalSeparation.replayPlanApprovalDoesNotApproveRepair, true);
  assert.equal(authorization.rules.repairRequesterMayApproveOwnRepair, false);
  assert.equal(authorization.rules.replayRequesterMayApproveOwnPlan, false);
  assert.equal(contract.approval.waiverRequiresSecondPerson, true);
  assert.equal(contract.waiverCommandSemantics.separateApprovalEndpointExists, false);
  const waiverApproval = api.additionalExamples.find(({ id }) => id === 'approve-waiver-with-same-endpoint');
  assert.ok(waiverApproval.request.waiverRequestId);
  assert.equal(waiverApproval.response.status, 'WAIVED');
});

test('R0 explicitly inherits v1 state machines and retains error metadata', () => {
  assert.equal(contract.inheritsFrom.fixture, 'event-replay-contract-v1.json');
  assert.match(contract.inheritsFrom.rule, /only inheritedSections carry forward/i);
  assert.ok(contract.inheritsFrom.inheritedSections.includes('failureStatuses'));
  assert.ok(contract.inheritsFrom.inheritedSections.includes('projectionExecutionModes'));
  assert.ok(contract.inheritsFrom.inheritedSections.includes('validationModeSemantics'));
  for (const retired of ['featureGates', 'encryption', 'objectStore']) {
    assert.ok(contract.inheritsFrom.supersededSections.includes(retired));
    assert.ok(!contract.inheritsFrom.inheritedSections.includes(retired));
  }
  assert.deepEqual(contract.selectionStrategies, ['EXACT', 'DEPENDENCY_CLOSURE']);
  assert.deepEqual(contract.validationModes, ['VALIDATE_ONLY', 'ROLLBACK_DRY_RUN', 'EXECUTE']);
  assert.ok(contract.replayRequestTransitions.APPROVED.includes('EXPIRED'));

  const errors = new Map(contract.errors.map((error) => [error.code, error]));
  assert.equal(errors.get('AUTHORIZATION_DENIED').httpStatus, 403);
  assert.equal(errors.get('PAYLOAD_DIGEST_MISMATCH').httpStatus, 409);
  assert.equal(errors.get('EVENT_NOT_REPLAYABLE').httpStatus, 422);
  assert.equal(typeof errors.get('REPAIR_FINGERPRINT_MISMATCH').retryable, 'boolean');
});

test('R0 freezes execution-only pause and event-driven wakeup semantics', () => {
  assert.equal(contract.activation.enabledDefault, true);
  assert.deepEqual(contract.activation.enabledControls, ['EXECUTE_TRANSITION', 'WORKER_CLAIM']);
  assert.ok(contract.activation.enabledDoesNotControl.includes('CAPTURE'));
  assert.ok(contract.activation.enabledDoesNotControl.includes('REPAIR'));
  assert.equal(contract.notification.channel, 'event_replay_ready');
  assert.equal(contract.notification.notificationIsWakeupHintOnly, true);
  assert.equal(contract.notification.durableWorkRecord, 'event_replay_request_t');
  assert.equal(contract.notification.connectionRequirement, 'DIRECT_OR_SESSION_POOLING');
  assert.equal(contract.notification.transactionPoolingSupported, false);
  assert.equal(contract.activation.missingOrStaleReplicaConfirmsPause, false);
});

test('R0 freezes typed repair policy and exact exclusion matching', () => {
  assert.equal(policy.contractVersion, 'event-replay-v2');
  assert.equal(policy.compatibleFixtureVersion, null);
  assert.equal(policy.excludedEventTypes.matching, 'EXACT');
  assert.equal(policy.excludedEventTypes.wildcardsAllowed, false);
  assert.equal(policy.excludedEventTypes.orderedPolicyMayBeExcluded, false);
  assert.equal(policy.repairSchemaDefinition.rawCloudEventEditorAllowed, false);
  assert.equal(policy.repairSchemaDefinition.immutableEnvelopeAndOrderingFields, true);
  assert.equal(policy.versionPinning.referencedVersionMayBeRemoved, false);
  assert.equal(contract.payloadDigestContract.digestInput, 'EXACT_STORED_BYTES');
  assert.equal(contract.payloadDigestContract.jsonbReserializationAllowed, false);
  assert.equal(contract.orderedScopeGuard.preCaptureRaceCanAppendLaterVersion, true);
  assert.equal(contract.orderedScopeGuard.genericGapAdvancingBreakGlass, false);
  assert.ok(policy.validationStages.includes('COMMAND_BEFORE_OFFSET_RESERVATION'));
  assert.ok(policy.validationStages.includes('EXECUTE_BEFORE_HANDLER'));
});
