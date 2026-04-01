import { JsonRpcRequest, McpTool, JsonRpcMessage } from './types';

export class McpClient {
  private socket: WebSocket | null = null;
  private pendingRequests = new Map<string | number, { resolve: (val: any) => void, reject: (err: any) => void }>();
  private connectionPromise: Promise<void> | null = null;
  private shouldReconnect = true;
  private onOpenCallback?: () => void;
  private onCloseCallback?: () => void;
  private onErrorCallback?: (err: any) => void;
  private onNotificationCallback?: (method: string, params: any) => void;
  private protocolProvider: () => string[];

  constructor(private url: string, protocolsOrProvider?: string[] | (() => string[])) {
    if (typeof protocolsOrProvider === 'function') {
      this.protocolProvider = protocolsOrProvider;
    } else {
      const p = protocolsOrProvider || [];
      this.protocolProvider = () => p;
    }
  }

  public onOpen(cb: () => void) { this.onOpenCallback = cb; }
  public onClose(cb: () => void) { this.onCloseCallback = cb; }
  public onError(cb: (err: any) => void) { this.onErrorCallback = cb; }
  public onNotification(cb: (method: string, params: any) => void) { this.onNotificationCallback = cb; }

  public async connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;
    if (!this.shouldReconnect) {
      return Promise.reject(new Error('Reconnect disabled'));
    }

    const allProtocols = this.protocolProvider();

    const promise = new Promise<void>((resolve, reject) => {
      try {
        // Pass sub-protocols (e.g. csrf token) via Sec-WebSocket-Protocol header
        const socket = allProtocols.length > 0
          ? new WebSocket(this.url, allProtocols)
          : new WebSocket(this.url);
        this.socket = socket;

        socket.onopen = async () => {
          try {
            // Internal handshake - bypass the public request() to avoid deadlock
            await this.rawRequest('initialize', {
              protocolVersion: '2025-11-25',
              capabilities: {},
              clientInfo: { name: 'portal-view', version: '0.1.0' }
            });
            await this.rawRequest('notifications/initialized', {});

            this.onOpenCallback?.();
            resolve();
          } catch (err) {
            reject(err);
          }
        };

        socket.onmessage = (event) => {
          try {
            const data: JsonRpcMessage = JSON.parse(event.data);

            if ('id' in data && data.id !== undefined) {
              if (data.id === null) {
                const protocolError = new Error('Protocol error: Received JSON-RPC message with null id');
                console.warn('Received JSON-RPC message with null id:', data);
                // Reject all pending requests to avoid hanging promises and leaking memory
                this.pendingRequests.forEach(p => p.reject(protocolError));
                this.pendingRequests.clear();
                // Notify error handler, if any
                this.onErrorCallback?.(protocolError);
                // Close the socket to fail the connection and allow reconnect logic to run
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                  this.socket.close();
                }
                return;
              }
              // This is a JsonRpcResponse
              const pending = this.pendingRequests.get(data.id);
              if (pending) {
                this.pendingRequests.delete(data.id);
                if (data.error) {
                  pending.reject(data.error);
                } else {
                  pending.resolve(data.result);
                }
              }
            } else if ('method' in data) {
              // This is a JsonRpcNotification
              this.onNotificationCallback?.(data.method, data.params);
            }
          } catch (err) {
            console.error('Failed to parse MCP message', err);
          }
        };

        socket.onerror = (err) => {
          this.onErrorCallback?.(err);
          reject(err);
        };

        socket.onclose = () => {
          this.socket = null;
          this.connectionPromise = null;
          this.pendingRequests.forEach(p => p.reject(new Error('Connection closed')));
          this.pendingRequests.clear();
          this.onCloseCallback?.();

          if (this.shouldReconnect) {
            setTimeout(() => {
              // Re-check reconnect flag in case it was disabled after the timeout was scheduled
              if (!this.shouldReconnect) {
                return;
              }
              this.connect().catch(err => {
                // Only surface errors if reconnect is still enabled (avoid spurious errors on intentional close)
                if (this.shouldReconnect) {
                  this.onErrorCallback?.(err);
                }
              });
            }, 3000);
          }
        };
      } catch (err) {
        // WebSocket constructor threw synchronously (e.g. invalid subprotocol).
        // No socket events will fire, so we must clear state here to allow retries.
        this.socket = null;
        reject(err);
      }
    });

    this.connectionPromise = promise;

    // If the promise was rejected (e.g. synchronous WebSocket construction failure
    // or an initialization/handshake error), clear connectionPromise so callers can
    // retry with a fresh connection and ensure any partially-open socket is closed.
    promise.catch(() => {
      // Only clear if this is still the active connection attempt.
      if (this.connectionPromise === promise) {
        this.connectionPromise = null;
        // If a socket object exists for this failed attempt, close and discard it
        // so that subsequent connect() calls start from a clean state.
        if (this.socket) {
          try {
            this.socket.close();
          } catch {
            // Ignore errors while closing a failed socket.
          }
          this.socket = null;
        }
      }
    });

    return promise;
  }

  public async listTools(): Promise<McpTool[]> {
    const result = await this.request('tools/list', {});
    return result.tools || [];
  }

  public async callTool(name: string, args: any): Promise<any> {
    const response = await this.request('tools/call', { name, arguments: args });

    // MCP unwrap: if the response has a content array, try to find the JSON part
    if (response && Array.isArray(response.content)) {
      const jsonContent = response.content.find((c: any) => c.type === 'json');
      if (jsonContent) {
        return jsonContent.json;
      }
      const textContent = response.content.find((c: any) => c.type === 'text');
      if (textContent) {
        return textContent.text;
      }
    }
    return response;
  }

  private async request(method: string, params: any): Promise<any> {
    await this.connect();
    return this.rawRequest(method, params);
  }

  private async rawRequest(method: string, params: any): Promise<any> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    const id = Math.random().toString(36).substring(2, 11);
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.socket?.send(JSON.stringify(request));
    });
  }

  public close() {
    this.shouldReconnect = false;
    this.socket?.close();
  }
}
