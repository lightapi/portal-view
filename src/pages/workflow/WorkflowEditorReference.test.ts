import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { buildReferenceSnippet, workflowToolAccessItems, workflowReferenceAccessLabel } from './WorkflowEditor';

describe('workflow callable Tool snippets', () => {
    it('distinguishes broad access, specific grants and required access in editor options', () => {
        expect(workflowReferenceAccessLabel({accessStatus:'GRANTED',authorizationSource:'HOST_TOOL'})).toBe('Available to all workflows in this Host');
        expect(workflowReferenceAccessLabel({accessStatus:'GRANTED',authorizationSource:'SPECIFIC_GRANT'})).toBe('Specifically granted to this workflow');
        expect(workflowReferenceAccessLabel({accessStatus:'REQUESTABLE'})).toBe('Access required');
        expect(workflowReferenceAccessLabel({accessStatus:'PENDING_APPROVAL'})).toBe('Access required · approval pending');
    });
    it('generates canonical HTTP YAML with a logical URI and immutable Tool pin', () => {
        const snippet = buildReferenceSnippet({
            kind: 'endpoints',
            id: '019c0000-0000-7000-8000-000000000001',
            value: 'customer-api/preferences.get',
            label: 'Customer API · 1.0.0 · Preferences',
            capabilityRef: 'customer-api/preferences.get',
            toolVersion: '1.0.0',
            lightapiDigest: `sha256:${'a'.repeat(64)}`,
            httpMethod: 'get',
            parameterLocations: { customerId: 'path', channel: 'query', requestId: 'header' },
        });
        const task = YAML.parse(`do:\n${snippet}`)?.do?.[0];

        expect(task['call-customer-api-1-0-0-preferences']).toMatchObject({
            call: 'http',
            with: {
                method: 'GET',
                endpoint: { uri: 'lightapi://customer-api/preferences.get' },
                query: { channel: '${{ channel }}' },
                headers: { requestId: '${{ requestId }}' },
                output: 'content',
            },
            metadata: {
                workflowTool: {
                    toolId: '019c0000-0000-7000-8000-000000000001',
                    capabilityRef: 'customer-api/preferences.get',
                    version: '1.0.0',
                    lightapiDigest: `sha256:${'a'.repeat(64)}`,
                    allowedEnvironments: ['local'],
                },
            },
        });
    });

    it('groups repeated uses into one exact access item with all usage locations', () => {
        const pin = `
        workflowTool:
          toolId: 019c0000-0000-7000-8000-000000000001
          capabilityRef: customer-api/preferences.get
          version: 1.0.0
          lightapiDigest: sha256:${'a'.repeat(64)}
          allowedEnvironments: [dev, loc]`;
        const definition = `document: { dsl: 1.0.3, namespace: test, name: access, version: 1.0.0 }
do:
  - first:
      call: http
      with: { method: GET, endpoint: { uri: lightapi://customer-api/preferences.get } }
      metadata:${pin}
  - second:
      call: http
      with: { method: GET, endpoint: { uri: lightapi://customer-api/preferences.get } }
      metadata:${pin}
`;

        expect(workflowToolAccessItems(definition)).toEqual([expect.objectContaining({
            toolId: '019c0000-0000-7000-8000-000000000001',
            allowedEnvironments: ['dev', 'loc'],
            usageLocations: expect.arrayContaining(['do[0].first.metadata', 'do[1].second.metadata']),
        })]);
    });
});
