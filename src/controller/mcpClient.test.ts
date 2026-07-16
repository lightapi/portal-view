import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpClient, McpClientError, mutationInterruptionError } from './mcpClient';

class FakeSocket {
  readyState = 0;
  protocol = '';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: any[] = [];
  autoInitialize = true;

  open(protocol = '') {
    this.readyState = 1;
    this.protocol = protocol;
    this.onopen?.({} as Event);
  }

  send(data: string) {
    const message = JSON.parse(data);
    this.sent.push(message);
    if (message.method === 'initialize' && this.autoInitialize) {
      queueMicrotask(() => this.respond(message.id, { protocolVersion: '2025-11-25' }));
    }
  }

  respond(id: string, result: unknown) {
    this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', id, result }) } as MessageEvent);
  }

  rpcError(id: string, message: string) {
    this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }) } as MessageEvent);
  }

  notify(method: string, params: unknown) {
    this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', method, params }) } as MessageEvent);
  }

  close(code = 1000) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('McpClient', () => {
  it('surfaces an interrupted mutation as an ambiguous outcome', () => {
    for (const category of ['connection', 'timeout', 'aborted'] as const) {
      const interrupted = mutationInterruptionError(
        'clear_cache',
        new McpClientError(category, 'Original bounded error'),
      );
      expect(interrupted).toMatchObject({ category });
      expect(interrupted.message).toContain('result is unknown');
      expect(interrupted.message).toContain('refresh the runtime state before retrying');
    }

    const readFailure = new McpClientError('connection', 'Control connection closed');
    expect(mutationInterruptionError('get_cache_entries', readFailure)).toBe(readFailure);
  });
  let sockets: FakeSocket[];
  let client: McpClient;

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    client = new McpClient('wss://portal.test/ctrl/mcp', ['csrf.token'], {
      webSocketFactory: (_url, _protocols) => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      random: () => 0.5,
      isOnline: () => true,
      addOnlineListener: () => () => undefined,
    });
  });

  afterEach(() => {
    client.close();
    vi.useRealTimers();
  });

  async function ready() {
    const connected = client.connect();
    sockets[0].open('csrf.token');
    await flush();
    await connected;
  }

  it('initializes before readiness and accepts only an offered selected protocol', async () => {
    const states: string[] = [];
    client.onStateChange((state) => states.push(state));
    const connecting = client.connect();
    expect(sockets).toHaveLength(1);
    sockets[0].open('csrf.token');
    await flush();
    await connecting;
    expect(sockets[0].sent.map((message) => message.method)).toEqual([
      'initialize', 'notifications/initialized',
    ]);
    expect(states).toEqual(['connecting', 'initializing', 'ready']);
  });

  it('uses one socket for concurrent Strict Mode-style connect calls', async () => {
    const first = client.connect();
    const second = client.connect();
    expect(second).toBe(first);
    expect(sockets).toHaveLength(1);
    sockets[0].open('csrf.token');
    await flush();
    await Promise.all([first, second]);
  });

  it('enforces separate connection and initialization deadlines', async () => {
    const unopened = client.connect();
    const unopenedExpectation = expect(unopened).rejects.toMatchObject({ category: 'timeout' });
    await vi.advanceTimersByTimeAsync(10_000);
    await unopenedExpectation;
    client.close();

    sockets = [];
    client = new McpClient('wss://portal.test/ctrl/mcp', ['csrf.token'], {
      webSocketFactory: () => {
        const socket = new FakeSocket();
        socket.autoInitialize = false;
        sockets.push(socket);
        return socket;
      },
      random: () => 0.5,
      isOnline: () => true,
      addOnlineListener: () => () => undefined,
      addOfflineListener: () => () => undefined,
    });
    const uninitialized = client.connect();
    const uninitializedExpectation = expect(uninitialized).rejects.toMatchObject({ category: 'timeout' });
    sockets[0].open('csrf.token');
    await vi.advanceTimersByTimeAsync(10_000);
    await uninitializedExpectation;
  });

  it('supports a future application protocol selection and never reconnects after manual close', async () => {
    client.close();
    sockets = [];
    client = new McpClient('wss://portal.test/ctrl/mcp', ['csrf.token', 'light-mcp-json-v1'], {
      webSocketFactory: (_url, _protocols) => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      random: () => 0.5,
      isOnline: () => true,
      addOnlineListener: () => () => undefined,
      addOfflineListener: () => () => undefined,
    });
    const connected = client.connect();
    sockets[0].open('light-mcp-json-v1');
    await flush();
    await connected;
    client.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });

  it('serializes requests and rejects saturation beyond 128 entries', async () => {
    await ready();
    const requests = Array.from({ length: 128 }, (_, index) => client.callTool('list_instances', { index }));
    await flush();
    expect(client.getPendingCount()).toBe(128);
    await expect(client.callTool('list_instances', {})).rejects.toMatchObject({ category: 'backpressure' });
    expect(sockets[0].sent.filter((message) => message.method === 'tools/call')).toHaveLength(1);
    for (let index = 0; index < requests.length; index += 1) {
      const active = sockets[0].sent.filter((message) => message.method === 'tools/call')[index];
      sockets[0].respond(active.id, { content: [{ type: 'json', json: { index } }] });
      await flush();
    }
    await expect(Promise.all(requests)).resolves.toHaveLength(128);
  });

  it('removes cancelled and timed-out requests without blocking the queue', async () => {
    await ready();
    const abort = new AbortController();
    const cancelled = client.callTool('list_instances', {}, { signal: abort.signal });
    abort.abort();
    await expect(cancelled).rejects.toMatchObject({ category: 'aborted' });

    const timedOut = client.callTool('list_instances', {}, { timeoutMs: 25 });
    await flush();
    const timedOutExpectation = expect(timedOut).rejects.toMatchObject({ category: 'timeout' });
    await vi.advanceTimersByTimeAsync(25);
    await timedOutExpectation;
    expect(client.getPendingCount()).toBe(0);
  });

  it('rejects every active and queued request on disconnect without mutation replay', async () => {
    await ready();
    const first = client.callTool('set_loggers', { runtimeInstanceId: 'runtime-a', loggers: [] });
    const second = client.callTool('list_instances', {});
    await flush();
    sockets[0].close(1001);
    await expect(first).rejects.toMatchObject({ category: 'connection' });
    await expect(second).rejects.toMatchObject({ category: 'connection' });
    await vi.advanceTimersByTimeAsync(250);
    expect(sockets).toHaveLength(2);
    expect(sockets[1].sent).toHaveLength(0);
  });

  it('ignores duplicate and unknown IDs and reports malformed envelopes safely', async () => {
    const errors: McpClientError[] = [];
    client.onError((error) => errors.push(error));
    await ready();
    const request = client.callTool('list_instances', {});
    await flush();
    const call = sockets[0].sent.find((message) => message.method === 'tools/call');
    sockets[0].respond('unknown', {});
    sockets[0].onmessage?.({ data: '{bad' } as MessageEvent);
    sockets[0].respond(call.id, { content: [{ type: 'json', json: { instances: [] } }] });
    sockets[0].respond(call.id, { duplicate: true });
    await expect(request).resolves.toEqual({ instances: [] });
    expect(errors).toHaveLength(1);
    expect(errors[0].category).toBe('invalid-message');
  });

  it('backs off safe reads on resource limits but never retries mutations', async () => {
    await ready();
    const read = client.callTool('list_instances', {});
    await flush();
    let call = sockets[0].sent.find((message) => message.method === 'tools/call');
    sockets[0].rpcError(call.id, 'resource-limit');
    await vi.advanceTimersByTimeAsync(500);
    call = sockets[0].sent.filter((message) => message.method === 'tools/call')[1];
    sockets[0].respond(call.id, { content: [{ type: 'json', json: { instances: [] } }] });
    await expect(read).resolves.toEqual({ instances: [] });

    const mutation = client.callTool('clear_cache', { runtimeInstanceId: 'runtime-a', name: 'x' });
    await flush();
    call = sockets[0].sent.filter((message) => message.method === 'tools/call').at(-1);
    sockets[0].rpcError(call.id, 'resource-limit');
    await expect(mutation).rejects.toMatchObject({ category: 'backpressure' });
  });

  it('rehydrates before recreating requested streams after the lifetime close', async () => {
    const order: string[] = [];
    let releaseRehydration: (() => void) | undefined;
    const rehydrated = new Promise<void>((resolve) => { releaseRehydration = resolve; });
    client.onReady(async (generation) => {
      order.push(`rehydrate-${generation}`);
      if (generation === 2) await rehydrated;
    });
    await ready();
    const started = client.callTool('start_logs', { runtimeInstanceId: 'runtime-a', level: 'INFO' });
    await flush();
    const start = sockets[0].sent.find((message) => message.method === 'tools/call');
    sockets[0].respond(start.id, { content: [{ type: 'json', json: { started: true } }] });
    await started;
    sockets[0].close(1001);
    await vi.advanceTimersByTimeAsync(250);
    sockets[1].open('csrf.token');
    await flush();
    expect(order).toEqual(['rehydrate-1', 'rehydrate-2']);
    expect(sockets[1].sent.filter((message) => message.method === 'tools/call')).toHaveLength(0);
    releaseRehydration?.();
    await flush();
    await flush();
    const restored = sockets[1].sent.find((message) => message.method === 'tools/call');
    expect(restored?.params.arguments.runtimeInstanceId).toBe('runtime-a');
    sockets[1].respond(restored.id, { content: [{ type: 'json', json: { started: true } }] });
    await flush();
  });

  it('retries only the targeted requested stream after a lease failure', async () => {
    await ready();
    for (const runtimeInstanceId of ['runtime-a', 'runtime-b']) {
      const pending = client.callTool('start_logs', { runtimeInstanceId });
      await flush();
      const call = sockets[0].sent.filter((message) => message.method === 'tools/call').at(-1);
      sockets[0].respond(call.id, { content: [{ type: 'json', json: { started: true } }] });
      await pending;
    }
    const before = sockets[0].sent.length;
    sockets[0].notify('notifications/log_stream_status', {
      runtimeInstanceId: 'runtime-a', status: 'stopped', retryable: true,
    });
    await vi.advanceTimersByTimeAsync(500);
    const retry = sockets[0].sent.slice(before).find((message) => message.method === 'tools/call');
    expect(retry.params.arguments.runtimeInstanceId).toBe('runtime-a');
  });
});
