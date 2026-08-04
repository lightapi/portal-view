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

describe('Aliases resource form navigation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listLlm.mockReset();
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a',publicAliasId:'alias-a',environment:'prod',aliasName:'governed-chat',
      operations:['chat_completions'],requiredCapabilities:{tools:true,streaming:true},
      maxInputTokens:128000,maxOutputTokens:8192,maxRequestBytes:1048576,
      dataClassification:'internal',loggingMode:'METADATA',piiMode:'REDACT',
      lifecycleStatus:'ACTIVE',aliasVisibility:'PUBLIC',aggregateVersion:5,active:true,
      updateUser:'system',updateTs:'2026-08-01T12:00:00Z',
    }]);
  });

  it('opens create and update forms with only declared alias fields', async () => {
    const alias = llmAdminResources.find(resource => resource.key === 'aliases')!;
    render(<ResourcePanel hostId="host-a" resource={alias}/>);

    await userEvent.click(await screen.findByRole('button',{name:'Create public alias'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createPublicAlias',{
      state:{data:{hostId:'host-a'}},
    });

    mocks.navigate.mockClear();
    await userEvent.click(await screen.findByLabelText('Edit'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updatePublicAlias',{
      state:{data:expect.objectContaining({
        hostId:'host-a',publicAliasId:'alias-a',environment:'prod',aliasName:'governed-chat',
        operations:['chat_completions'],requiredCapabilities:{tools:true,streaming:true},
        maxInputTokens:128000,maxOutputTokens:8192,maxRequestBytes:1048576,
        dataClassification:'internal',loggingMode:'METADATA',piiMode:'REDACT',
        lifecycleStatus:'ACTIVE',aliasVisibility:'PUBLIC',aggregateVersion:5,
      })},
    }));
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('active');
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
  });
});
