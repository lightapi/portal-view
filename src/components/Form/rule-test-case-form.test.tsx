import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { publishTestConfig } from '../../test/runtimeConfigFixture';
import Form from './Form';
import forms from '../../data/Forms.json';
import { utils } from 'react-schema-form';

vi.mock('../../contexts/UserContext', () => ({ useUserState: () => ({ host: 'host-a', isAuthenticated: true }) }));
vi.mock('../../utils/fetchClient', () => ({ default: vi.fn().mockResolvedValue([]) }));
vi.mock('../HelpLink', () => ({ default: () => null }));
vi.mock('react-schema-form', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-schema-form')>(),
  SchemaForm: ({ model }: { model: unknown }) => <output data-testid="model">{JSON.stringify(model)}</output>,
}));

beforeEach(() => publishTestConfig());

it.each(['createRuleTestCase', 'updateRuleTestCase'])(
  'uses the schema executor default when opening %s without an executor', async (formId) => {
  render(<MemoryRouter initialEntries={[{
    pathname: `/app/form/${formId}`,
    state: { data: { hostId: 'host-a', ruleId: 'cel-rule' } },
  }]}><Routes><Route path="/app/form/:formId" element={<Form />} /></Routes></MemoryRouter>);
  expect(JSON.parse((await screen.findByTestId('model')).textContent!)).toMatchObject({
    hostId: 'host-a', ruleId: 'cel-rule', executorType: 'rust',
  });
});

it.each(['java', 'both'])('legacy %s records remain editable under the update schema', async (executorType) => {
  render(<MemoryRouter initialEntries={[{
    pathname: '/app/form/updateRuleTestCase',
    state: { data: { hostId: 'host-a', ruleId: 'cel-rule', testId: 'test-1', testName: 'Legacy CEL test', inputContext: '{}', executorType } },
  }]}><Routes><Route path="/app/form/:formId" element={<Form />} /></Routes></MemoryRouter>);
  const model = JSON.parse((await screen.findByTestId('model')).textContent!);
  expect(model.executorType).toBe(executorType);
  expect(utils.validateBySchema(forms.updateRuleTestCase.schema, model).valid).toBe(true);
});
