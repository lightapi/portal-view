import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import forms from '../../data/Forms.json';
import RuleDetail from './RuleDetail';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../contexts/UserContext', () => ({ useUserState: () => ({ host: 'host-a' }) }));
vi.mock('../../utils/fetchClient', () => ({ default: mocks.fetch }));

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.fetch.mockImplementation((url: string) => {
    const command = JSON.parse(new URL(url, 'https://portal.test').searchParams.get('cmd')!);
    return Promise.resolve(command.action === 'runRuleTestCase' ? { success: true, executorType: 'rust' } : {
      testCases: [{ ruleId: 'cel-rule', testId: 'test-1', testName: 'Saved Java test', executorType: 'java' }],
      total: 1,
    });
  });
});

function LocationState() { return <output data-testid="state">{JSON.stringify(useLocation().state)}</output>; }
function mount() {
  return render(<MemoryRouter initialEntries={[{
    pathname: '/app/rule/RuleDetail',
    state: { rule: { hostId: 'host-a', ruleId: 'cel-rule', expression: 'input.amount > 10', active: true } },
  }]}><RuleDetail /><LocationState /></MemoryRouter>);
}

it('runs legacy saved test cases using the Workflow executor', async () => {
  mount();
  expect(await screen.findByText('saved executor: java')).toBeVisible();
  expect(screen.queryByText('saved executor: rust')).not.toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: 'Run' }));
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  const [url] = mocks.fetch.mock.calls[1];
  const command = JSON.parse(new URL(url, 'https://portal.test').searchParams.get('cmd')!);
  expect(command.action).toBe('runRuleTestCase');
  expect(command.data).toMatchObject({ ruleId: 'cel-rule', testId: 'test-1', executorType: 'rust' });
  expect(screen.getByText('saved executor: java')).toBeVisible();
  expect(await screen.findByText(/"executorType": "rust"/)).toBeVisible();
});

it('creates test cases with the Workflow executor and offers no Java executor', async () => {
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /Add Test Case/i }));
  expect(JSON.parse(screen.getByTestId('state').textContent!).data.executorType).toBeUndefined();
  expect(forms.createRuleTestCase.schema.properties.executorType.enum).toEqual(['rust']);
  expect(forms.updateRuleTestCase.schema.properties.executorType.enum).toEqual(['rust', 'java', 'both']);
  expect(forms.createRuleTestCase.schema.properties.executorType.default).toBe('rust');
  expect(forms.updateRuleTestCase.schema.properties.executorType.default).toBe('rust');
});
