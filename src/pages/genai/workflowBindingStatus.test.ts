import {describe, expect, it} from 'vitest';
import {workflowBindingStatus} from './workflowBindingStatus';

const base = {executionPlacement: 'workflow', publicationStatus: 'active', needsPublish: false,
  publishedBindingDigest: 'sha256:current', gatewayBindingDigest: 'sha256:current'};

describe('Workflow Tool binding status', () => {
  it.each([
    [{}, 'Active'],
    [{gatewayBindingDigest: null}, 'Approved, not yet on Gateway'],
    [{gatewayBindingDigest: 'sha256:older'}, 'Approved, not yet on Gateway'],
    [{needsPublish: true}, 'Needs publish'],
    [{needsPublish: true, gatewayBindingDigest: 'sha256:older'}, 'Needs publish'],
    [{publicationStatus: 'pendingApproval'}, 'Pending approval'],
    [{publicationStatus: 'rejected', needsPublish: true}, 'Rejected'],
    [{publicationStatus: 'revoked', needsPublish: true}, 'Revoked'],
    [{publicationStatus: 'failed', needsPublish: true}, 'Failed'],
    [{publicationStatus: null}, 'Needs publish'],
  ])('maps %j to %s', (delta, label) => {
    expect(workflowBindingStatus({...base, ...delta})?.label).toBe(label);
  });
  it('uses the Step 10 comment for failure and rejection tooltips', () => {
    expect(workflowBindingStatus({...base, publicationStatus: 'failed', publicationComment: 'WORKFLOW_INPUT_INVALID: bad'}))
      .toMatchObject({label: 'Failed', detail: 'WORKFLOW_INPUT_INVALID: bad'});
    expect(workflowBindingStatus({...base, publicationStatus: 'rejected', publicationComment: 'Too broad'})?.detail)
      .toBe('Too broad');
  });
});
