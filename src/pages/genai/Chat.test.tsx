import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import Chat from './Chat';
import fetchClient from '../../utils/fetchClient';
vi.mock('../../utils/fetchClient', () => ({ default: vi.fn() }));
const agent = { hostId: 'host-a', instanceId: 'instance-a', instanceName: 'Personal Codex', productId: 'agt', serviceId: 'com.networknt.agent.codex-personal-1.0.0', envTag: 'test', active: true };
async function connect(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Connect' }));
  return Socket.instances[Socket.instances.length - 1];
}

const state = vi.hoisted(() => ({ email: 'owner@example.com', isAuthenticated: true, host: 'host-a' }));
vi.mock('../../contexts/UserContext', () => ({ useUserState: () => state }));
class Socket {
  static OPEN = 1; static CONNECTING = 0; static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.({ code: 1000 } as CloseEvent); });
  constructor(public url: string, public protocols: string[]) { Socket.instances.push(this); }
  receive(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
beforeEach(() => {
  Socket.instances = []; sessionStorage.clear(); state.host = 'host-a'; state.email = 'owner@example.com'; state.isAuthenticated = true;
  vi.mocked(fetchClient).mockReset().mockResolvedValue({ instances: [agent], total: 1 });
  window.history.replaceState({}, '', '/app/genai/chat?instanceId=instance-a');
  document.cookie = 'csrf=csrf-test';
  vi.stubGlobal('WebSocket', Socket);
  Element.prototype.scrollIntoView = vi.fn();
});
it('uses the authenticated Gateway route and sends a typed coding payload only after session admission', async () => {
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Env Tag')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Turn type')).not.toBeInTheDocument();
  act(() => { socket.readyState = 1; socket.onopen?.(); });
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  act(() => socket.receive({ type: 'session', session_id: 'session-a', turnTypes: ['chat', 'coding'], defaultTurnType: 'chat' }));
  fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'hello' } });
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({ text: 'hello', clientMessageId: expect.any(String) });
  socket.send.mockClear();
  await user.click(screen.getByRole('combobox', { name: 'Turn type' }));
  await user.click(screen.getByRole('option', { name: 'Coding implementation' }));
  for (const [label, value] of Object.entries({ 'Repository bundle URI': 'file:///spool/repo.bundle', 'Bundle SHA-256': 'sha256:' + 'a'.repeat(64), 'Bundle size (bytes)': '42', 'Base commit': 'b'.repeat(40) })) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  expect(new URL(socket.url).pathname).toBe('/chat');
  expect(new URL(socket.url).searchParams.get('serviceId')).toBe('com.networknt.agent.codex-personal-1.0.0');
  expect(socket.protocols).toEqual(['csrf.csrf-test']);
  expect(new URL(socket.url).searchParams.get('envTag')).toBe('test');
  expect(new URL(socket.url).searchParams.get('protocol')).toBe('http');
  fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'Change README' } });
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  const sent = JSON.parse(socket.send.mock.calls[0][0]);
  expect(sent.profile).toBe('coding'); expect(sent.coding.role).toBe('implement');
  expect(sent.coding.repository.size).toBe(42); expect(sent.clientMessageId).toBeTruthy();
  expect(sent).not.toHaveProperty('authenticationProfile');
  act(() => socket.receive({ type: 'executionAccepted', profile: 'coding', request_id: 'request-a' }));
  expect(screen.getByText(/This is not a completed coding turn/)).toBeInTheDocument();
  const download = screen.getByRole('link', { name: 'Download acceptance' });
  expect(download).toHaveAttribute('download', 'accepted.json');
  expect(JSON.parse(decodeURIComponent(download.getAttribute('href')!.split(',').slice(1).join(',')))).toEqual({ sessionId: 'session-a', request_id: 'request-a', profile: 'coding' });
});
it('retains the ordinary chat payload and closes a socket when the Host changes', async () => {
  const user = userEvent.setup(); const view = render(<Chat />);
  const socket = await connect(user);

  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a' }); });
  fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'Hello' } });
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({ text: 'Hello', clientMessageId: expect.any(String) });
  state.host = 'host-b'; view.rerender(<Chat />);
  expect(socket.close).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
});

it('queries active agt instances in the current Host and allows changing the preselected agent', async () => {
  const other = { ...agent, instanceId: 'instance-b', instanceName: 'Account', serviceId: 'account', envTag: 'prod' };
  vi.mocked(fetchClient).mockResolvedValue({ instances: [agent, other, { ...agent, instanceId: 'wrong-product', productId: 'agt-extra' }], total: 3 });
  const user = userEvent.setup(); render(<Chat />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled());
  const request = vi.mocked(fetchClient).mock.calls[0][1].body;
  expect(request.action).toBe('getInstance');
  expect(request.data.hostId).toBe('host-a'); expect(request.data.active).toBe(true);
  expect(JSON.parse(request.data.filters)).toEqual([{ id: 'productId', value: 'agt' }]);
  await user.click(screen.getByRole('combobox', { name: 'Agent' }));
  expect(screen.getAllByRole('option')).toHaveLength(2);
  await user.click(screen.getByRole('option', { name: 'Account · prod' }));
  const socket = await connect(user);
  expect(new URL(socket.url).searchParams.get('serviceId')).toBe('account');
  expect(new URL(socket.url).searchParams.get('envTag')).toBe('prod');
});

it('shows query errors with retry and does not connect to an unavailable deep link', async () => {
  vi.mocked(fetchClient).mockRejectedValueOnce(new Error('Service unavailable'));
  const user = userEvent.setup(); render(<Chat />);
  expect(await screen.findByText(/Service unavailable/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  vi.mocked(fetchClient).mockResolvedValue({ instances: [], total: 0 });
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText(/linked agent is unavailable/)).toBeInTheDocument();
  expect(Socket.instances).toHaveLength(0);
});

it('requires CSRF and reports an upgrade failure with a deliberate new-session retry', async () => {
  const user = userEvent.setup(); render(<Chat />);
  document.cookie = 'csrf=; Max-Age=0';
  await connect(user);
  expect(Socket.instances).toHaveLength(0);
  expect(screen.getByText(/missing its CSRF token/)).toBeInTheDocument();
  document.cookie = 'csrf=csrf-test';
  const socket = await connect(user);
  act(() => socket.onerror?.());
  expect(screen.getByText(/Could not connect to Personal Codex/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'New session' }));
  expect(Socket.instances).toHaveLength(2);
});

it('paginates instances and supports ordinary agents that send the older session frame', async () => {
  vi.mocked(fetchClient).mockResolvedValueOnce({ instances: [agent], total: 2 })
    .mockResolvedValueOnce({ instances: [{ ...agent, instanceId: 'instance-b' }], total: 2 });
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  expect(vi.mocked(fetchClient).mock.calls[1][1].body.data.offset).toBe(1);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a' }); });
  expect(screen.queryByRole('combobox', { name: 'Turn type' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Repository bundle URI')).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('Type your message here...')).toBeEnabled();
});

it('ignores a late instance response from the previous Host', async () => {
  let resolveOld!: (value: unknown) => void;
  vi.mocked(fetchClient).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = render(<Chat />);
  state.host = 'host-b';
  vi.mocked(fetchClient).mockResolvedValue({ instances: [], total: 0 });
  view.rerender(<Chat />);
  await screen.findByText(/linked agent is unavailable/);
  await act(async () => resolveOld({ instances: [agent], total: 1 }));
  expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Agent' })).not.toHaveTextContent('Personal Codex');
});

it('times out a socket that opens without admitting a session and cleans up on unmount', async () => {
  const user = userEvent.setup(); const view = render(<Chat />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled());
  vi.useFakeTimers();
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const socket = Socket.instances[0];
    act(() => { socket.readyState = 1; socket.onopen?.(); vi.advanceTimersByTime(30000); });
    expect(screen.getByText(/within 30 seconds/)).toBeInTheDocument();
    act(() => socket.receive({ type: 'session', session_id: 'late-session', turnTypes: ['coding'], defaultTurnType: 'coding' }));
    expect(screen.queryByLabelText('Repository bundle URI')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const retry = Socket.instances[1];
    view.unmount();
    expect(retry.onmessage).toBeNull();
    expect(retry.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});

it('resumes only the selected agent environment and offers an explicit fresh session after failure', async () => {
  sessionStorage.setItem('agentSessionId:host-a:test:owner@example.com:com.networknt.agent.codex-personal-1.0.0:instance-a', 'old-session');
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  expect(new URL(socket.url).searchParams.get('sessionId')).toBe('old-session');
  act(() => socket.onclose?.({ code: 1006 } as CloseEvent));
  socket.readyState = 3;
  await user.click(screen.getByRole('button', { name: 'New session' }));
  expect(new URL(Socket.instances[1].url).searchParams.has('sessionId')).toBe(false);
});


it('keeps sessions separate for instances sharing the same service and environment', async () => {
  vi.mocked(fetchClient).mockResolvedValue({ instances: [agent, { ...agent, instanceId: 'instance-b', instanceName: 'Second deployment' }], total: 2 });
  const user = userEvent.setup(); render(<Chat />);
  const first = await connect(user);
  act(() => { first.readyState = 1; first.onopen?.(); first.receive({ type: 'session', session_id: 'first-session' }); });
  await user.click(screen.getByRole('button', { name: 'Disconnect' }));
  await user.click(screen.getByRole('combobox', { name: 'Agent' }));
  await user.click(screen.getByRole('option', { name: 'Second deployment · test' }));
  const second = await connect(user);
  expect(new URL(second.url).searchParams.has('sessionId')).toBe(false);
  act(() => { second.readyState = 1; second.onopen?.(); second.receive({ type: 'session', session_id: 'second-session' }); });
  await user.click(screen.getByRole('button', { name: 'Disconnect' }));
  await user.click(screen.getByRole('combobox', { name: 'Agent' }));
  await user.click(screen.getByRole('option', { name: 'Personal Codex · test' }));
  expect(new URL((await connect(user)).url).searchParams.get('sessionId')).toBe('first-session');
});

it('uses fetched agents when the reported total is larger than the available rows', async () => {
  vi.mocked(fetchClient).mockResolvedValueOnce({ instances: [agent], total: 150 })
    .mockResolvedValueOnce({ instances: [], total: 150 });
  const user = userEvent.setup(); render(<Chat />);
  await connect(user);
  expect(Socket.instances).toHaveLength(1);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not show a connection failure when the user disconnects before admission', async () => {
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); });
  await user.click(screen.getByRole('button', { name: 'Disconnect' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
});

it('disconnects unsupported agents and allows selecting another without reloading', async () => {
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'unsupported', turnTypes: ['future-mode'] }); });
  expect(screen.getByRole('combobox', { name: 'Agent' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'New session' })).toBeEnabled();
  expect(screen.getByPlaceholderText('Type your message here...')).toBeDisabled();
  expect(socket.close).toHaveBeenCalled();
});

it('lists ambiguous legacy-link candidates and accepts an explicit selection', async () => {
  window.history.replaceState({}, '', '/app/genai/chat?' + new URLSearchParams({ serviceId: agent.serviceId, envTag: agent.envTag }));
  vi.mocked(fetchClient).mockResolvedValue({ instances: [agent, { ...agent, instanceId: 'instance-b', instanceName: 'Second deployment' }], total: 2 });
  const user = userEvent.setup(); render(<Chat />);
  expect(await screen.findByText(/This link matches multiple deployed agents/)).toHaveTextContent('Second deployment');
  expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  await user.click(screen.getByRole('combobox', { name: 'Agent' }));
  await user.click(screen.getByRole('option', { name: 'Second deployment · test' }));
  await connect(user);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});


it('cancels the admission deadline when a deliberate close handshake is delayed', async () => {
  render(<Chat />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled());
  vi.useFakeTimers();
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const socket = Socket.instances[0];
    act(() => { socket.readyState = 1; socket.onopen?.(); });
    socket.close.mockImplementation(() => { socket.readyState = 2; });
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    act(() => { vi.advanceTimersByTime(30000); socket.onerror?.(); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
  } finally { vi.useRealTimers(); }
});

it('preserves the session initialization error in the alert after the close frame', async () => {
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); });
  const message = "The agent's active-session limit has been reached.";
  act(() => socket.receive({ type: 'error', code: 'SESSION_LIMIT_EXCEEDED', message }));
  act(() => socket.onclose?.({ code: 1013 } as CloseEvent));
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('alert')).not.toHaveTextContent('closed before the agent initialized');
});

it('renews expired authentication and reconnects the same session without replaying a draft', async () => {
  document.cookie = 'userId=owner'; document.cookie = 'host=host-a';
  const refresh = vi.fn().mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal('fetch', refresh);
  const user = userEvent.setup(); render(<Chat />); const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a' });
    socket.receive({ type: 'authentication_context', expiresAt: Math.floor(Date.now()/1000)-1 }); });
  fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'draft' } });
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => expect(Socket.instances).toHaveLength(2));
  expect(refresh).toHaveBeenCalledOnce(); expect(socket.send).not.toHaveBeenCalled();
  const renewed = Socket.instances[1]; expect(new URL(renewed.url).searchParams.get('sessionId')).toBe('session-a');
  act(() => { renewed.readyState = 1; renewed.onopen?.(); renewed.receive({ type: 'session', session_id: 'session-a' }); });
  expect(renewed.send).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText('Type your message here...')).toHaveValue('draft');
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  expect(renewed.send).toHaveBeenCalledOnce();
});

it('does not replay an accepted turn on reauthentication and reconciles its status', async () => {
  document.cookie = 'userId=owner'; document.cookie = 'host=host-a';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  const user = userEvent.setup(); render(<Chat />); const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a' }); });
  fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'accepted' } });
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  const id = JSON.parse(socket.send.mock.calls[0][0]).clientMessageId;
  act(() => { socket.receive({ type: 'turnAccepted', clientMessageId: id, turnId: 'turn-a' });
    socket.receive({ type: 'authentication_required', clientMessageId: id, admitted: true }); });
  await waitFor(() => expect(Socket.instances).toHaveLength(2)); const renewed = Socket.instances[1];
  act(() => { renewed.readyState = 1; renewed.onopen?.(); renewed.receive({ type: 'session', session_id: 'session-a' });
    renewed.receive({ type: 'turn_status', turns: [{ turnId: 'turn-a', clientMessageId: id, state: 'FAILED' }] }); });
  expect(renewed.send).not.toHaveBeenCalled(); expect(screen.getByText('Previous turn status: FAILED.')).toBeInTheDocument();
});

it('blocks reconnect if cookie renewal changes the owner', async () => {
  document.cookie = 'userId=owner'; document.cookie = 'host=host-a';
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { document.cookie = 'userId=other'; return { ok: true, status: 200 }; }));
  const user = userEvent.setup(); render(<Chat />); const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a' }); socket.receive({ type: 'authentication_required', admitted: true }); });
  expect(await screen.findByText(/Authentication renewal failed/)).toBeInTheDocument(); expect(Socket.instances).toHaveLength(1);
});

it('cancels a pending renewal when the Host changes', async () => {
  document.cookie = 'userId=owner'; document.cookie = 'host=host-a';
  let finish!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })));
  const user = userEvent.setup(); const view = render(<Chat />); const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a' }); socket.receive({ type: 'authentication_required', admitted: true }); });
  state.host = 'host-b'; view.rerender(<Chat />);
  await act(async () => finish({ ok: true, status: 200 }));
  expect(Socket.instances).toHaveLength(1);
});

it('preserves every queued message identifier when acknowledgements arrive out of order', async () => {
  const user = userEvent.setup(); render(<Chat />); const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a' }); });
  for (const text of ['first', 'second']) {
    fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: text } });
    await user.click(screen.getByRole('button', { name: 'Send message' }));
  }
  const ids = socket.send.mock.calls.map(([body]) => JSON.parse(body).clientMessageId);
  act(() => { socket.receive({ type: 'turnAccepted', clientMessageId: ids[1], turnId: 'turn-2' }); socket.receive({ type: 'turnAccepted', clientMessageId: ids[0], turnId: 'turn-1' }); });
  const key = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)!).find(key => key.endsWith(':turns'))!;
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual([{ clientMessageId: ids[0], turnId: 'turn-1' }, { clientMessageId: ids[1], turnId: 'turn-2' }]);
});

it.each([
  { types: ['chat'], defaultType: 'chat' },
  { types: ['coding'], defaultType: 'coding' },
  { types: ['chat', 'coding'], defaultType: 'coding' },
])('honors published turn policy $types with default $defaultType', async ({ types, defaultType }) => {
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  act(() => {
    socket.readyState = 1; socket.onopen?.();
    socket.receive({ type: 'session', session_id: 'policy-session', turnTypes: types, defaultTurnType: defaultType });
  });
  if (types.length === 1) {
    expect(screen.queryByRole('combobox', { name: 'Turn type' })).not.toBeInTheDocument();
    expect(screen.getByText(defaultType === 'coding' ? 'Coding implementation' : 'Chat', { selector: '.MuiChip-label' })).toBeInTheDocument();
  } else {
    expect(screen.getByRole('combobox', { name: 'Turn type' })).toHaveTextContent('Coding implementation');
  }
  if (defaultType === 'coding') {
    expect(screen.getByLabelText('Repository bundle URI')).toBeInTheDocument();
  } else {
    expect(screen.queryByLabelText('Repository bundle URI')).not.toBeInTheDocument();
  }
});

it('displays durable coding completion once and never displays failure payloads as answers', async () => {
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a', turnTypes: ['coding'], defaultTurnType: 'coding' }); });
  const result = { type: 'executionResult', turnId: 'turn-a', state: 'COMPLETED', text: 'The configuration is loaded at startup.' };
  act(() => { socket.receive(result); socket.receive(result); });
  expect(screen.getAllByText(result.text)).toHaveLength(1);
  act(() => socket.receive({ ...result, turnId: 'turn-b', state: 'FAILED', text: 'Do not present this as success' }));
  expect(screen.getByText('Coding task turn-b: FAILED.')).toBeInTheDocument();
  expect(screen.queryByText('Do not present this as success')).not.toBeInTheDocument();
});

it('offers only advertised workspaces and submits a task without repository bundle fields', async () => {
  const user = userEvent.setup(); render(<Chat />);
  const socket = await connect(user);
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a', turnTypes: ['coding'], defaultTurnType: 'coding' }); });
  expect(screen.queryByLabelText('Workspace')).not.toBeInTheDocument();
  act(() => socket.receive({ type: 'workspaceCatalog', workspaces: [{ workspaceId: 'personal', membershipRevision: 'sha256:'+'a'.repeat(64), runnerId: 'personal-codex-runner', intents: ['inspect', 'implement', 'review'] }] }));
  expect(screen.getByRole('combobox', { name: 'Workspace' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Repository bundle URI')).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'Explain the config loader' } });
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  const payload = JSON.parse(socket.send.mock.calls[0][0]);
  expect(payload.profile).toBe('coding'); expect(payload).not.toHaveProperty('coding');
  expect(payload.workspace).toMatchObject({ workspaceId: 'personal', intent: 'inspect', requestId: payload.clientMessageId, instruction: payload.text, task: { kind: 'new' } });
  expect(payload.workspace).not.toHaveProperty('subject'); expect(payload.workspace).not.toHaveProperty('store');
  act(() => socket.receive({ type: 'executionResult', turnId: 'turn-a', state: 'COMPLETED', text: 'It loads at startup.', workspace: { workspaceId: 'personal', taskId: 'task-one', checkpointDigest: 'sha256:'+'b'.repeat(64) } }));
  expect(screen.getByLabelText('Existing task ID')).toHaveValue('task-one');
});
