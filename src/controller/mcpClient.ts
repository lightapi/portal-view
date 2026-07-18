import { JsonRpcRequest, McpTool } from './types';

export type McpConnectionState =
  | 'idle'
  | 'connecting'
  | 'initializing'
  | 'ready'
  | 'backoff'
  | 'offline'
  | 'closed';

export type McpErrorCategory =
  | 'aborted'
  | 'backpressure'
  | 'connection'
  | 'invalid-message'
  | 'not-supported'
  | 'policy'
  | 'timeout';

export class McpClientError extends Error {
  constructor(public readonly category: McpErrorCategory, message: string) {
    super(message.slice(0, 256));
    this.name = 'McpClientError';
  }
}

export interface McpRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  safeRead?: boolean;
}

interface WebSocketLike {
  readonly readyState: number;
  readonly protocol: string;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface PendingRequest {
  id: string;
  method: string;
  params: unknown;
  options: Required<Pick<McpRequestOptions, 'timeoutMs' | 'safeRead'>> & Pick<McpRequestOptions, 'signal'>;
  resolve: (value: any) => void;
  reject: (error: McpClientError) => void;
  timer?: ReturnType<typeof setTimeout>;
  abortHandler?: () => void;
  retryCount: number;
  createdAt: number;
}

export interface McpClientDependencies {
  webSocketFactory?: (url: string, protocols: string[]) => WebSocketLike;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  random?: () => number;
  now?: () => number;
  isOnline?: () => boolean;
  addOnlineListener?: (listener: () => void) => () => void;
  addOfflineListener?: (listener: () => void) => () => void;
}

const OPEN = 1;
const CONNECT_DEADLINE_MS = 10_000;
const INITIALIZE_DEADLINE_MS = 10_000;
const DEFAULT_REQUEST_DEADLINE_MS = 15_000;
const MAX_PENDING_REQUESTS = 128;
const RECONNECT_BASE_MS = 500;
const RECONNECT_CAP_MS = 30_000;
const STABLE_CONNECTION_MS = 10_000;
const MAX_SAFE_READ_RETRIES = 3;

const MUTATING_TOOLS = new Set([
  'clear_cache',
  'configure_chaos_monkey',
  'reload_modules',
  'run_chaos_monkey_assault',
  'set_loggers',
  'set_logging_filter',
  'shutdown_service',
  'start_logs',
  'stop_logs',
]);

export function isMutatingTool(name: string): boolean {
  return MUTATING_TOOLS.has(name);
}

export function mutationInterruptionError(name: string, error: unknown): McpClientError {
  const cause = safeError(error, 'Control operation was interrupted');
  if (!isMutatingTool(name) || !['connection', 'timeout', 'aborted'].includes(cause.category)) {
    return cause;
  }
  const reason = cause.category === 'timeout'
    ? 'The operation timed out'
    : cause.category === 'aborted'
      ? 'The operation was cancelled'
      : 'The connection was lost during the operation';
  return new McpClientError(
    cause.category,
    `${reason}. Its result is unknown; refresh the runtime state before retrying.`,
  );
}

const LONG_RUNNING_TOOL_TIMEOUTS = new Map<string, number>([
  ['clear_cache', 60_000],
  ['configure_chaos_monkey', 60_000],
  ['get_log_content', 30_000],
  ['reload_modules', 60_000],
  ['run_chaos_monkey_assault', 60_000],
  ['shutdown_service', 60_000],
  ['start_logs', 30_000],
  ['stop_logs', 30_000],
]);

function defaultWebSocketFactory(url: string, protocols: string[]): WebSocketLike {
  return protocols.length > 0 ? new WebSocket(url, protocols) : new WebSocket(url);
}

function defaultOnlineListener(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('online', listener);
  return () => window.removeEventListener('online', listener);
}

function defaultOfflineListener(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('offline', listener);
  return () => window.removeEventListener('offline', listener);
}

function isResourceLimit(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { message?: unknown; data?: unknown };
  const text = `${String(value.message ?? '')} ${JSON.stringify(value.data ?? '')}`.toLowerCase();
  return text.includes('resource-limit') || text.includes('resource limit') || text.includes('rate limit');
}

function safeError(error: unknown, fallback: string): McpClientError {
  if (error instanceof McpClientError) return error;
  if (error instanceof Error && error.message) {
    return new McpClientError('connection', error.message);
  }
  return new McpClientError('connection', fallback);
}

export class McpClient {
  private socket: WebSocketLike | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestQueue: PendingRequest[] = [];
  private retryTimers = new Map<PendingRequest, ReturnType<typeof setTimeout>>();
  private activeRequestId: string | null = null;
  private connectionPromise: Promise<void> | null = null;
  private state: McpConnectionState = 'idle';
  private shouldReconnect = true;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private stableTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempt = 0;
  private generation = 0;
  private idCounter = 0;
  private readonly idPrefix: string;
  private readonly streamIntents = new Map<string, Record<string, unknown>>();
  private readonly streamRetryAttempts = new Map<string, number>();
  private removeOnlineListener: () => void;
  private removeOfflineListener: () => void;
  private onOpenCallback?: () => void;
  private onReadyCallback?: (generation: number) => void | Promise<void>;
  private onCloseCallback?: () => void;
  private onErrorCallback?: (error: McpClientError) => void;
  private onNotificationCallback?: (method: string, params: any) => void;
  private onStateCallback?: (state: McpConnectionState) => void;
  private readonly protocolProvider: () => string[];
  private readonly webSocketFactory: (url: string, protocols: string[]) => WebSocketLike;
  private readonly scheduleTimeout: typeof globalThis.setTimeout;
  private readonly cancelTimeout: typeof globalThis.clearTimeout;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly isOnline: () => boolean;

  constructor(
    private readonly url: string,
    protocolsOrProvider?: string[] | (() => string[]),
    dependencies: McpClientDependencies = {},
  ) {
    this.protocolProvider = typeof protocolsOrProvider === 'function'
      ? protocolsOrProvider
      : () => protocolsOrProvider || [];
    this.webSocketFactory = dependencies.webSocketFactory || defaultWebSocketFactory;
    this.scheduleTimeout = dependencies.setTimeout || globalThis.setTimeout.bind(globalThis);
    this.cancelTimeout = dependencies.clearTimeout || globalThis.clearTimeout.bind(globalThis);
    this.random = dependencies.random || Math.random;
    this.now = dependencies.now || Date.now;
    this.isOnline = dependencies.isOnline || (() => typeof navigator === 'undefined' || navigator.onLine);
    this.idPrefix = `${Math.floor(this.random() * Number.MAX_SAFE_INTEGER).toString(36)}-${this.now().toString(36)}`;
    this.removeOnlineListener = (dependencies.addOnlineListener || defaultOnlineListener)(() => {
      if (this.shouldReconnect && this.state === 'offline') this.scheduleReconnect(0);
    });
    this.removeOfflineListener = (dependencies.addOfflineListener || defaultOfflineListener)(() => {
      if (!this.shouldReconnect) return;
      this.setState('offline');
      this.socket?.close(1001, 'browser offline');
    });
  }

  public onOpen(callback: () => void) { this.onOpenCallback = callback; }
  public onReady(callback: (generation: number) => void | Promise<void>) { this.onReadyCallback = callback; }
  public onClose(callback: () => void) { this.onCloseCallback = callback; }
  public onError(callback: (error: McpClientError) => void) { this.onErrorCallback = callback; }
  public onNotification(callback: (method: string, params: any) => void) { this.onNotificationCallback = callback; }
  public onStateChange(callback: (state: McpConnectionState) => void) { this.onStateCallback = callback; }
  public getState() { return this.state; }
  public getGeneration() { return this.generation; }
  public getPendingCount() { return this.pendingRequests.size + this.requestQueue.length + this.retryTimers.size; }
  public getRequestedStreamRuntimeIds() { return Array.from(this.streamIntents.keys()); }
  public removeRequestedStream(runtimeInstanceId: string) {
    this.streamIntents.delete(runtimeInstanceId);
    this.streamRetryAttempts.delete(runtimeInstanceId);
  }

  public connect(): Promise<void> {
    if (this.state === 'ready') return Promise.resolve();
    if (this.connectionPromise) return this.connectionPromise;
    if (!this.shouldReconnect) return Promise.reject(new McpClientError('connection', 'Client is closed'));
    if (!this.isOnline()) {
      this.setState('offline');
      return Promise.reject(new McpClientError('connection', 'Browser is offline'));
    }

    this.clearReconnectTimer();
    const offeredProtocols = Array.from(new Set(this.protocolProvider()));
    this.setState('connecting');

    const attempt = new Promise<void>((resolve, reject) => {
      let settled = false;
      let opened = false;
      let deadline = this.scheduleTimeout(() => {
        finish(new McpClientError('timeout', 'WebSocket connection timed out'));
        this.socket?.close(1000, 'connect timeout');
      }, CONNECT_DEADLINE_MS);
      const finish = (error?: McpClientError) => {
        if (settled) return;
        settled = true;
        this.cancelTimeout(deadline);
        error ? reject(error) : resolve();
      };

      try {
        const socket = this.webSocketFactory(this.url, offeredProtocols);
        this.socket = socket;
        socket.onopen = () => {
          opened = true;
          this.cancelTimeout(deadline);
          if (socket.protocol && !offeredProtocols.includes(socket.protocol)) {
            finish(new McpClientError('policy', 'Gateway selected an unoffered WebSocket protocol'));
            socket.close(1008, 'invalid protocol');
            return;
          }
          this.setState('initializing');
          deadline = this.scheduleTimeout(() => {
            finish(new McpClientError('timeout', 'MCP initialization timed out'));
            socket.close(1000, 'initialize timeout');
          }, INITIALIZE_DEADLINE_MS);
          this.sendImmediate('initialize', {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'portal-view', version: '0.1.0' },
          }, INITIALIZE_DEADLINE_MS).then(async () => {
            this.sendNotification('notifications/initialized', {});
            this.cancelTimeout(deadline);
            this.generation += 1;
            this.setState('ready');
            this.startStableTimer();
            await this.onReadyCallback?.(this.generation);
            await this.restoreRequestedStreams();
            this.onOpenCallback?.();
            finish();
            this.dispatchNext();
          }).catch((error) => {
            finish(safeError(error, 'MCP initialization failed'));
            socket.close(1000, 'initialize failed');
          });
        };
        socket.onmessage = (event) => this.handleMessage(event.data);
        socket.onerror = () => {
          const error = new McpClientError('connection', 'WebSocket transport error');
          this.onErrorCallback?.(error);
          if (!opened) finish(error);
        };
        socket.onclose = (event) => {
          const error = new McpClientError(
            event.code === 1008 ? 'policy' : 'connection',
            opened ? 'Control connection closed' : 'Control connection could not be opened',
          );
          finish(error);
          this.handleClose(socket, error, event.code === 1008);
        };
      } catch (error) {
        this.socket = null;
        finish(safeError(error, 'WebSocket construction failed'));
      }
    });

    this.connectionPromise = attempt;
    attempt.catch((error) => {
      if (this.connectionPromise === attempt) this.connectionPromise = null;
      if (this.shouldReconnect) this.scheduleReconnect();
      this.onErrorCallback?.(safeError(error, 'Connection failed'));
    });
    return attempt;
  }

  public async listTools(options: McpRequestOptions = {}): Promise<McpTool[]> {
    const result = await this.request('tools/list', {}, { ...options, safeRead: true });
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  public async callTool(name: string, args: any, options: McpRequestOptions = {}): Promise<any> {
    const safeRead = options.safeRead ?? !MUTATING_TOOLS.has(name);
    const timeoutMs = options.timeoutMs ?? LONG_RUNNING_TOOL_TIMEOUTS.get(name);
    const response = await this.request(
      'tools/call',
      { name, arguments: args },
      { ...options, timeoutMs, safeRead },
    );
    const result = this.unwrapToolResponse(response);
    const runtimeInstanceId = typeof args?.runtimeInstanceId === 'string' ? args.runtimeInstanceId : undefined;
    if (runtimeInstanceId && name === 'start_logs') this.streamIntents.set(runtimeInstanceId, { ...args });
    if (runtimeInstanceId && name === 'stop_logs') {
      this.streamIntents.delete(runtimeInstanceId);
      this.streamRetryAttempts.delete(runtimeInstanceId);
    }
    return result;
  }

  public sendNotification(method: string, params: unknown): boolean {
    if (!this.socket || this.socket.readyState !== OPEN) return false;
    this.socket.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
    return true;
  }

  public close(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.stableTimer) this.cancelTimeout(this.stableTimer);
    this.removeOnlineListener();
    this.removeOfflineListener();
    this.rejectAll(new McpClientError('connection', 'Client closed'));
    const socket = this.socket;
    this.socket = null;
    this.connectionPromise = null;
    this.setState('closed');
    socket?.close(1000, 'client closed');
  }

  private async request(method: string, params: unknown, options: McpRequestOptions): Promise<any> {
    await this.connect();
    if (this.state !== 'ready') {
      throw new McpClientError('connection', 'Control connection is not ready');
    }
    return this.enqueue(method, params, options);
  }

  private enqueue(method: string, params: unknown, options: McpRequestOptions): Promise<any> {
    if (this.getPendingCount() >= MAX_PENDING_REQUESTS) {
      return Promise.reject(new McpClientError('backpressure', 'Control request queue is full'));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new McpClientError('aborted', 'Control request was cancelled'));
    }
    return new Promise((resolve, reject) => {
      const request: PendingRequest = {
        id: this.nextId(),
        method,
        params,
        options: {
          timeoutMs: options.timeoutMs ?? DEFAULT_REQUEST_DEADLINE_MS,
          safeRead: options.safeRead ?? false,
          signal: options.signal,
        },
        resolve,
        reject,
        retryCount: 0,
        createdAt: this.now(),
      };
      if (options.signal) {
        request.abortHandler = () => this.cancelRequest(request, new McpClientError('aborted', 'Control request was cancelled'));
        options.signal.addEventListener('abort', request.abortHandler, { once: true });
      }
      this.requestQueue.push(request);
      this.dispatchNext();
    });
  }

  private sendImmediate(method: string, params: unknown, timeoutMs: number): Promise<any> {
    if (!this.socket || this.socket.readyState !== OPEN) {
      return Promise.reject(new McpClientError('connection', 'WebSocket is not open'));
    }
    return new Promise((resolve, reject) => {
      const request: PendingRequest = {
        id: this.nextId(), method, params,
        options: { timeoutMs, safeRead: false, signal: undefined },
        resolve, reject, retryCount: 0, createdAt: this.now(),
      };
      this.sendRequest(request, false);
    });
  }

  private dispatchNext(): void {
    if (this.state !== 'ready' || this.activeRequestId || !this.socket || this.socket.readyState !== OPEN) return;
    const next = this.requestQueue.shift();
    if (next) this.sendRequest(next, true);
  }

  private sendRequest(request: PendingRequest, serialized: boolean): void {
    if (!this.socket || this.socket.readyState !== OPEN) {
      request.reject(new McpClientError('connection', 'WebSocket is not open'));
      return;
    }
    if (serialized) this.activeRequestId = request.id;
    this.pendingRequests.set(request.id, request);
    const elapsed = Math.max(0, this.now() - request.createdAt);
    const remaining = Math.max(1, request.options.timeoutMs - elapsed);
    request.timer = this.scheduleTimeout(() => {
      this.pendingRequests.delete(request.id);
      if (this.activeRequestId === request.id) this.activeRequestId = null;
      this.cleanupRequest(request);
      request.reject(new McpClientError('timeout', 'Control request timed out'));
      this.dispatchNext();
    }, remaining);
    const payload: JsonRpcRequest = { jsonrpc: '2.0', id: request.id, method: request.method, params: request.params };
    this.socket.send(JSON.stringify(payload));
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') {
      this.onErrorCallback?.(new McpClientError('invalid-message', 'Non-text MCP message rejected'));
      return;
    }
    let message: any;
    try { message = JSON.parse(raw); } catch {
      this.onErrorCallback?.(new McpClientError('invalid-message', 'Malformed MCP message rejected'));
      return;
    }
    if (!message || message.jsonrpc !== '2.0' || Array.isArray(message)) {
      this.onErrorCallback?.(new McpClientError('invalid-message', 'Invalid JSON-RPC envelope rejected'));
      return;
    }
    if (typeof message.method === 'string' && !Object.prototype.hasOwnProperty.call(message, 'id')) {
      this.handleNotification(message.method, message.params);
      return;
    }
    if (typeof message.id !== 'string' || (('result' in message) === ('error' in message))) {
      this.onErrorCallback?.(new McpClientError('invalid-message', 'Invalid JSON-RPC response rejected'));
      return;
    }
    const pending = this.pendingRequests.get(message.id);
    if (!pending) return; // duplicate and unknown response IDs are intentionally ignored
    this.pendingRequests.delete(message.id);
    if (this.activeRequestId === message.id) this.activeRequestId = null;
    this.cleanupRequest(pending);
    if (message.error) {
      if (isResourceLimit(message.error) && pending.options.safeRead && pending.retryCount < MAX_SAFE_READ_RETRIES) {
        pending.retryCount += 1;
        pending.id = this.nextId();
        if (pending.options.signal?.aborted) {
          pending.reject(new McpClientError('aborted', 'Control request was cancelled'));
          this.dispatchNext();
          return;
        }
        if (pending.abortHandler && pending.options.signal) {
          pending.options.signal.addEventListener('abort', pending.abortHandler, { once: true });
        }
        const delay = this.backoffDelay(pending.retryCount);
        const retryTimer = this.scheduleTimeout(() => {
          this.retryTimers.delete(pending);
          if (this.state !== 'ready') {
            pending.reject(new McpClientError('connection', 'Control connection closed during backoff'));
          } else {
            this.requestQueue.unshift(pending);
            this.dispatchNext();
          }
        }, delay);
        this.retryTimers.set(pending, retryTimer);
      } else {
        const category: McpErrorCategory = isResourceLimit(message.error) ? 'backpressure' : 'not-supported';
        pending.reject(new McpClientError(category, String(message.error.message || 'Control request failed')));
      }
    } else {
      pending.resolve(message.result);
    }
    this.dispatchNext();
  }

  private handleNotification(method: string, params: any): void {
    this.onNotificationCallback?.(method, params);
    if (method !== 'notifications/log_stream_status' || params?.retryable !== true) return;
    const runtimeInstanceId = params?.runtimeInstanceId ?? params?.runtime_instance_id;
    if (typeof runtimeInstanceId !== 'string' || !this.streamIntents.has(runtimeInstanceId)) return;
    this.retryRequestedStream(runtimeInstanceId);
  }

  private retryRequestedStream(runtimeInstanceId: string): void {
    const attempt = (this.streamRetryAttempts.get(runtimeInstanceId) || 0) + 1;
    this.streamRetryAttempts.set(runtimeInstanceId, attempt);
    this.scheduleTimeout(async () => {
      const intent = this.streamIntents.get(runtimeInstanceId);
      if (!intent || this.state !== 'ready') return;
      try {
        await this.callTool('start_logs', intent, { timeoutMs: 30_000, safeRead: false });
        this.streamRetryAttempts.delete(runtimeInstanceId);
      } catch (error) {
        if (this.state === 'ready' && this.streamIntents.has(runtimeInstanceId)) this.retryRequestedStream(runtimeInstanceId);
      }
    }, this.backoffDelay(attempt));
  }

  private async restoreRequestedStreams(): Promise<void> {
    for (const [runtimeInstanceId, intent] of Array.from(this.streamIntents.entries())) {
      if (this.state !== 'ready' || !this.streamIntents.has(runtimeInstanceId)) return;
      try {
        await this.callTool('start_logs', intent, { timeoutMs: 30_000, safeRead: false });
      } catch {
        this.retryRequestedStream(runtimeInstanceId);
      }
    }
  }

  private handleClose(socket: WebSocketLike, error: McpClientError, policyClose: boolean): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.connectionPromise = null;
    if (this.stableTimer) this.cancelTimeout(this.stableTimer);
    this.rejectAll(error);
    this.onCloseCallback?.();
    if (!this.shouldReconnect) {
      this.setState('closed');
      return;
    }
    if (policyClose) this.streamIntents.clear();
    this.scheduleReconnect();
  }

  private rejectAll(error: McpClientError): void {
    for (const request of Array.from(this.pendingRequests.values())) {
      this.cleanupRequest(request);
      request.reject(error);
    }
    for (const request of this.requestQueue) {
      this.cleanupRequest(request);
      request.reject(error);
    }
    for (const [request, timer] of Array.from(this.retryTimers.entries())) {
      this.cancelTimeout(timer);
      this.cleanupRequest(request);
      request.reject(error);
    }
    this.pendingRequests.clear();
    this.requestQueue = [];
    this.retryTimers.clear();
    this.activeRequestId = null;
  }

  private cancelRequest(request: PendingRequest, error: McpClientError): void {
    const queuedIndex = this.requestQueue.indexOf(request);
    if (queuedIndex >= 0) this.requestQueue.splice(queuedIndex, 1);
    if (this.pendingRequests.delete(request.id) && this.activeRequestId === request.id) this.activeRequestId = null;
    const retryTimer = this.retryTimers.get(request);
    if (retryTimer) {
      this.cancelTimeout(retryTimer);
      this.retryTimers.delete(request);
    }
    this.cleanupRequest(request);
    request.reject(error);
    this.dispatchNext();
  }

  private cleanupRequest(request: PendingRequest): void {
    if (request.timer) this.cancelTimeout(request.timer);
    if (request.abortHandler && request.options.signal) request.options.signal.removeEventListener('abort', request.abortHandler);
    request.timer = undefined;
  }

  private scheduleReconnect(delayOverride?: number): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    if (!this.isOnline()) {
      this.setState('offline');
      return;
    }
    this.setState('backoff');
    const delay = delayOverride ?? this.backoffDelay(this.reconnectAttempt++);
    this.reconnectTimer = this.scheduleTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.shouldReconnect) this.connect().catch(() => undefined);
    }, delay);
  }

  private backoffDelay(attempt: number): number {
    const ceiling = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * (2 ** Math.min(attempt, 16)));
    return Math.floor(this.random() * ceiling);
  }

  private startStableTimer(): void {
    if (this.stableTimer) this.cancelTimeout(this.stableTimer);
    this.stableTimer = this.scheduleTimeout(() => { this.reconnectAttempt = 0; }, STABLE_CONNECTION_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) this.cancelTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }

  private setState(state: McpConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.onStateCallback?.(state);
  }

  private nextId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    this.idCounter += 1;
    return `${this.idPrefix}-${this.idCounter}`;
  }

  private unwrapToolResponse(response: any): any {
    if (!response || !Array.isArray(response.content)) return response;
    const jsonContent = response.content.find((content: any) => content?.type === 'json');
    if (jsonContent) return jsonContent.json;
    const textContent = response.content.find((content: any) => content?.type === 'text');
    return textContent ? textContent.text : response;
  }
}
