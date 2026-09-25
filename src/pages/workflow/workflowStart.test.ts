import { describe, expect, it } from 'vitest';
import { validateWorkflowStartReceipt } from './workflowStart';

const definitionId = '11111111-1111-4111-8111-111111111111';
const digest = `sha256:${'a'.repeat(64)}`;
const receipt = {
    accepted: true, workflowInstanceId: '33333333-3333-4333-8333-333333333333',
    processId: '44444444-4444-4444-8444-444444444444', workflowDefinitionId: definitionId,
    definitionDigest: digest, state: 'ACCEPTED', invocationStateVersion: 1,
    acceptedAt: '2026-09-25T14:00:00Z', replayed: false,
};

describe('Workflow start boundary', () => {
    it('accepts a committed definition start receipt', () => {
        expect(validateWorkflowStartReceipt(receipt, definitionId)).toEqual(receipt);
    });
    it('rejects malformed and mismatched receipts without claiming acceptance', () => {
        for (const result of [null, {}, { ...receipt, accepted: false },
            { ...receipt, processId: '' }, { ...receipt, workflowDefinitionId: '22222222-2222-4222-8222-222222222222' },
            { ...receipt, definitionDigest: 'bad' }, { ...receipt, acceptedAt: 'bad' }]) {
            expect(() => validateWorkflowStartReceipt(result, definitionId)).toThrow('unconfirmed');
        }
    });
});
