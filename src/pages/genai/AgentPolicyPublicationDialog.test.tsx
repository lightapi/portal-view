import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import AgentPolicyPublicationDialog from './AgentPolicyPublicationDialog';
const mocks = vi.hoisted(() => ({ read: vi.fn(), post: vi.fn() }));
vi.mock('../../utils/fetchClient', () => ({ default: mocks.read }));
vi.mock('../../api/apiPost', () => ({ apiPost: mocks.post }));
const candidate = { hostId: 'host', instanceId: 'instance', serviceId: 'agent', status: 'READY_TO_PUBLISH', candidateDigest: 'sha256:reviewed', propertyWrites: [{ propertyName: 'agentPolicy.execution.codingProfile', proposedValue: '{}' }] };
beforeEach(() => {
  mocks.read.mockResolvedValue({ agentPolicyCandidates: [candidate] });
  mocks.post.mockResolvedValue({ data: { status: 'ACTIVE', publicationId: 'publication', policySnapshotId: 'snapshot' } });
});
it('requires review and publishes only the preview digest for the selected instance', async () => {
  const user = userEvent.setup();
  render(<AgentPolicyPublicationDialog hostId="host" instanceId="instance" serviceId="agent" onClose={() => {}} />);
  await screen.findByText('READY_TO_PUBLISH');
  expect(screen.getByRole('button', { name: 'Publish and activate' })).toBeDisabled();
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Publish and activate' }));
  await screen.findByText(/Active publication publication/);
  expect(mocks.post.mock.calls[0][0].body.data).toEqual({ hostId: 'host', instanceId: 'instance', leaseProfile: 'BOUNDED', candidateDigest: 'sha256:reviewed' });
});
it('clears a rejected preview and requires a fresh review before retrying', async () => {
  mocks.post.mockResolvedValue({ error: new Error('Source changed after preview') });
  const user = userEvent.setup();
  render(<AgentPolicyPublicationDialog hostId="host" instanceId="instance" onClose={() => {}} />);
  await screen.findByText('READY_TO_PUBLISH');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Publish and activate' }));
  await screen.findByText(/Source changed/);
  expect(screen.getByRole('button', { name: 'Publish and activate' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Refresh preview' }));
  await screen.findByText('READY_TO_PUBLISH');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});
it('does not allow an old Host preview to replace the current selection', async () => {
  let finish!: (value: unknown) => void;
  mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<AgentPolicyPublicationDialog hostId="old" instanceId="old" onClose={() => {}} />);
  view.rerender(<AgentPolicyPublicationDialog hostId="host" instanceId="instance" onClose={() => {}} />);
  await screen.findByText('READY_TO_PUBLISH');
  finish({ agentPolicyCandidates: [{ ...candidate, hostId: 'old', instanceId: 'old', candidateDigest: 'stale' }] });
  await waitFor(() => expect(screen.queryByText(/"candidateDigest": "stale"/)).not.toBeInTheDocument());
});
it.each(['CURRENT', 'ERROR'])('cannot publish a %s candidate', async status => {
  mocks.read.mockResolvedValue({ agentPolicyCandidates: [{ ...candidate, status }] });
  render(<AgentPolicyPublicationDialog hostId="host" instanceId="instance" onClose={() => {}} />);
  await screen.findByText(status);
  expect(screen.getByRole('button', { name: 'Publish and activate' })).toBeDisabled();
});
