import { describe, expect, it } from 'vitest';
import { workflowEventFailureRows } from './workflowRuntimeState';

describe('workflowEventFailureRows', () => {
    it('exposes the quarantined workflow root cause', () => {
        expect(workflowEventFailureRows({
            workflowEventFailures: [{
                quarantineId: '01a00bda-9cd1-7f47-bcec-be78d80e4a59',
                failureCode: 'WORKFLOW_EVENT_HANDLER_FAILED',
                failureDetail: "task 'loadCustomerContext' uses fork",
                replayState: 'BLOCKED',
                createdTs: '2026-08-16T18:34:31Z',
            }],
        })).toEqual([{
            quarantineId: '01a00bda-9cd1-7f47-bcec-be78d80e4a59',
            failureCode: 'WORKFLOW_EVENT_HANDLER_FAILED',
            failureDetail: "task 'loadCustomerContext' uses fork",
            replayState: 'BLOCKED',
            createdTs: '2026-08-16T18:34:31Z',
        }]);
    });
});
