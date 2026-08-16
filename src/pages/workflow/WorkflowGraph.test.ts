import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { buildGraphModel, workflowForkJoinNodeId } from './WorkflowGraph';

const customerFork = YAML.parse(`
do:
  - loadCustomerContext:
      fork:
        branches:
          - profile:
              call: http
              with:
                endpoint:
                  uri: lightapi://API0004/getCustomerProfile
              metadata:
                workflowTool:
                  capabilityRef: API0004/getCustomerProfile
          - preferences:
              call: http
              metadata:
                workflowTool:
                  capabilityRef: API0004/getCustomerPreferences
          - policies:
              call: http
              metadata:
                workflowTool:
                  capabilityRef: API0004/getCustomerPolicies
        compete: false
  - appendResponses:
      set:
        customerId: "\${{ customerId }}"
`);

describe('workflow fork graph', () => {
    it('expands fork branches through a synthetic join into the next step', () => {
        const model = buildGraphModel(customerFork, {
            'loadCustomerContext::profile': 'C',
            'loadCustomerContext::preferences': 'C',
            'loadCustomerContext::policies': 'C',
        });
        const joinId = workflowForkJoinNodeId('loadCustomerContext');

        expect(model.nodes.map(node => node.id)).toEqual([
            'loadCustomerContext',
            'loadCustomerContext::profile',
            'loadCustomerContext::preferences',
            'loadCustomerContext::policies',
            joinId,
            'appendResponses',
        ]);
        expect(model.edges.filter(edge => edge.data?.kind === 'fork')).toHaveLength(3);
        expect(model.edges.filter(edge => edge.data?.kind === 'join')).toHaveLength(3);
        expect(model.edges).toContainEqual(expect.objectContaining({
            source: joinId,
            target: 'appendResponses',
            data: expect.objectContaining({ kind: 'order' }),
        }));
        expect(model.edges).not.toContainEqual(expect.objectContaining({
            source: 'loadCustomerContext',
            target: 'appendResponses',
        }));

        const profile = model.nodes.find(node => node.id === 'loadCustomerContext::profile');
        expect(profile?.data.step.selectionId).toBe('loadCustomerContext');
        expect(profile?.data.step.references).toContain('capabilityRef: API0004/getCustomerProfile');
        expect(profile?.data.status).toBe('C');

        const join = model.nodes.find(node => node.id === joinId);
        expect(join?.data.step.title).toBe('Join all');
        expect(join?.data.status).toBe('C');
        expect(join?.connectable).toBe(false);
    });

    it('marks a competing join complete after the first successful branch', () => {
        const definition = structuredClone(customerFork);
        definition.do[0].loadCustomerContext.fork.compete = true;
        const model = buildGraphModel(definition, {
            'loadCustomerContext::profile': 'C',
            'loadCustomerContext::preferences': 'A',
            'loadCustomerContext::policies': 'A',
        });
        const join = model.nodes.find(node => node.id === workflowForkJoinNodeId('loadCustomerContext'));

        expect(join?.data.step.title).toBe('Join first');
        expect(join?.data.status).toBe('C');
        expect(model.edges.filter(edge => edge.data?.label === 'compete')).toHaveLength(3);
    });

    it('keeps an explicit fork continuation editable through its semantic parent', () => {
        const definition = structuredClone(customerFork);
        definition.do[0].loadCustomerContext.then = 'appendResponses';
        const model = buildGraphModel(definition, {});
        const joinId = workflowForkJoinNodeId('loadCustomerContext');

        expect(model.edges).toContainEqual(expect.objectContaining({
            source: joinId,
            target: 'appendResponses',
            deletable: true,
            data: expect.objectContaining({
                kind: 'explicit',
                semanticSourceId: 'loadCustomerContext',
            }),
        }));
    });

    it('keeps ordinary ordered steps unchanged', () => {
        const model = buildGraphModel(YAML.parse(`
do:
  - prepare:
      set:
        value: ready
  - finish:
      set:
        value: done
`), {});

        expect(model.nodes.map(node => node.id)).toEqual(['prepare', 'finish']);
        expect(model.edges).toContainEqual(expect.objectContaining({
            source: 'prepare',
            target: 'finish',
            data: expect.objectContaining({ kind: 'order' }),
        }));
    });
});
