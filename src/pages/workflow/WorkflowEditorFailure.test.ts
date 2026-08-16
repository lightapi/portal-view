import { describe, expect, it } from 'vitest';
import { workflowEventFailureRows, workflowFinalOutput, workflowRuntimeSettled } from './workflowRuntimeState';

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

describe('workflowRuntimeSettled', () => {
    it('keeps polling while the workflow is active', () => {
        expect(workflowRuntimeSettled(['A'], [])).toBe(false);
    });

    it.each(['C', 'F', 'W', 'COMPLETED', 'FAILED', 'WAITING'])(
        'stops polling when the workflow status is %s',
        status => {
            expect(workflowRuntimeSettled([status], [])).toBe(true);
        },
    );

    it('stops polling for a blocked event-start failure without a process', () => {
        expect(workflowRuntimeSettled([], [{
            quarantineId: '01a00bda-9cd1-7f47-bcec-be78d80e4a59',
            failureCode: 'WORKFLOW_EVENT_HANDLER_FAILED',
            failureDetail: "task 'loadCustomerContext' uses fork",
            replayState: 'BLOCKED',
        }])).toBe(true);
    });
});

describe('workflowFinalOutput', () => {
    it('renders structured output from the last completed task', () => {
        expect(workflowFinalOutput(
            [{ statusCode: 'C' }],
            [{ statusCode: 'C', taskOutput: { customerId: 'CUST-1001', results: [] } }],
        )).toBe('{\n  "customerId": "CUST-1001",\n  "results": []\n}');
    });

    it('keeps legacy process resultCode precedence', () => {
        expect(workflowFinalOutput(
            [{ statusCode: 'C', resultCode: 'legacy-process-result' }],
            [{ statusCode: 'C', taskOutput: { value: 'task-result' } }],
        )).toBe('legacy-process-result');
    });
});
