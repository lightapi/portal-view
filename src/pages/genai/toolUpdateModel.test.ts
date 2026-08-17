import {describe, expect, it} from 'vitest';
import {freshToolForUpdate} from './toolUpdateModel';

describe('freshToolForUpdate', () => {
  it('uses the fresh read model without stale table-row safety values', () => {
    const freshData = {
      toolId: 'tool-1',
      aggregateVersion: 4,
      workflowVersionRef: 'workflow-1|1.0.0',
      toolMetadata: {
        safety: {read_only: true, idempotent: true},
      },
    };

    expect(freshToolForUpdate(freshData)).toBe(freshData);
    expect(freshToolForUpdate(freshData)).not.toHaveProperty('readOnly');
    expect(freshToolForUpdate(freshData)).not.toHaveProperty('idempotent');
  });
});
