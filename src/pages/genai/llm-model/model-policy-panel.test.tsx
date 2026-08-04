import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResourcePanel from './ResourcePanel';
import { llmAdminResources } from './types';

const mocks = vi.hoisted(() => ({
  listLlm:vi.fn(),queryLlm:vi.fn(),commandLlm:vi.fn(),navigate:vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {...actual,useNavigate:() => mocks.navigate};
});
vi.mock('./api', () => ({
  listLlm:mocks.listLlm,queryLlm:mocks.queryLlm,commandLlm:mocks.commandLlm,
}));

describe('Policies resource form navigation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listLlm.mockReset();
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a',modelPolicyId:'policy-a',policyName:'governed-chat',
      accessPolicy:{allowedSubjectTypes:['AGENT']},budgetPolicy:{monthlyCostMicros:50000000},
      contentPolicy:{loggingMode:'METADATA'},cachePolicy:{enabled:false},
      piiPolicy:{mode:'REDACT'},nativeExtensionPolicy:{openai:{allowedRequestFields:['service_tier']}},
      lifecycleStatus:'ACTIVE',aggregateVersion:4,active:true,
      updateUser:'system',updateTs:'2026-08-01T12:00:00Z',
    }]);
  });

  it('opens create and update forms with only declared policy fields', async () => {
    const policies = llmAdminResources.find(resource => resource.key === 'policies')!;
    render(<ResourcePanel hostId="host-a" resource={policies}/>);

    await userEvent.click(await screen.findByRole('button',{name:'Create model policy'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createModelPolicy',{
      state:{data:{hostId:'host-a'}},
    });

    mocks.navigate.mockClear();
    await userEvent.click(await screen.findByLabelText('Edit'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updateModelPolicy',{
      state:{data:expect.objectContaining({
        hostId:'host-a',modelPolicyId:'policy-a',policyName:'governed-chat',
        accessPolicy:{allowedSubjectTypes:['AGENT']},budgetPolicy:{monthlyCostMicros:50000000},
        contentPolicy:{loggingMode:'METADATA'},cachePolicy:{enabled:false},
        piiPolicy:{mode:'REDACT'},nativeExtensionPolicy:{openai:{allowedRequestFields:['service_tier']}},
        lifecycleStatus:'ACTIVE',aggregateVersion:4,
      })},
    }));
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('active');
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
  });
});
