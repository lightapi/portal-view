import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import Chat from './Chat';
const state = vi.hoisted(() => ({ email: 'owner@example.com', isAuthenticated: true, host: 'host-a' }));
vi.mock('../../contexts/UserContext', () => ({ useUserState: () => state }));
class Socket {
  static OPEN = 1; static CONNECTING = 0; static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  constructor(public url: string, public protocols: string[]) { Socket.instances.push(this); }
  receive(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
beforeEach(() => {
  Socket.instances = []; sessionStorage.clear(); state.host = 'host-a';
  window.history.replaceState({}, '', '/app/genai/chat?serviceId=com.networknt.agent.codex-personal-1.0.0&envTag=dev');
  document.cookie = 'csrf=csrf-test';
  vi.stubGlobal('WebSocket', Socket);
  Element.prototype.scrollIntoView = vi.fn();
});
it('uses the authenticated Gateway route and sends a typed coding payload only after session admission', async () => {
  const user = userEvent.setup(); render(<Chat />);
  expect(screen.getByLabelText('Agent')).toHaveValue('com.networknt.agent.codex-personal-1.0.0');
  await user.click(screen.getByRole('combobox', { name: 'Turn type' }));
  await user.click(screen.getByRole('option', { name: 'Coding implementation' }));
  for (const [label, value] of Object.entries({ 'Repository bundle URI': 'file:///spool/repo.bundle', 'Bundle SHA-256': 'sha256:' + 'a'.repeat(64), 'Bundle size (bytes)': '42', 'Base commit': 'b'.repeat(40) })) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  await user.click(screen.getByRole('button', { name: 'Connect' }));
  const socket = Socket.instances[0];
  expect(new URL(socket.url).pathname).toBe('/chat');
  expect(new URL(socket.url).searchParams.get('serviceId')).toBe('com.networknt.agent.codex-personal-1.0.0');
  expect(socket.protocols).toEqual(['csrf.csrf-test']);
  act(() => { socket.readyState = 1; socket.onopen?.(); });
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  act(() => socket.receive({ type: 'session', session_id: 'session-a' }));
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
  await user.click(screen.getByRole('button', { name: 'Connect' }));
  const socket = Socket.instances[0];
  act(() => { socket.readyState = 1; socket.onopen?.(); socket.receive({ type: 'session', session_id: 'session-a' }); });
  fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'Hello' } });
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({ text: 'Hello' });
  state.host = 'host-b'; view.rerender(<Chat />);
  expect(socket.close).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
});
