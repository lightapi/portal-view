import { JsonRpcRequest, JsonRpcResponse, McpTool } from './types';

export class McpClient {
  private socket: WebSocket | null = null;
  private pendingRequests = new Map<string | number, { resolve: (val: any) => void, reject: (err: any) => void }>();
  private connectionPromise: Promise<void> | null = null;
  private shouldReconnect = true;
  private onOpenCallback?: () => void;
  private onCloseCallback?: () => void;
  private onErrorCallback?: (err: any) => void;

  constructor(private url: string) {}

  public onOpen(cb: () => void) { this.onOpenCallback = cb; }
  public onClose(cb: () => void) { this.onCloseCallback = cb; }
  public onError(cb: (err: any) => void) { this.onErrorCallback = cb; }

  public async connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;
    this.shouldReconnect = true;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        const socket = new WebSocket(this.url);
        this.socket = socket;

        socket.onopen = async () => {
          try {
            // Internal handshake - bypass the public request() to avoid deadlock
            await this.rawRequest('initialize', {
              protocolVersion: '2026-03-26',
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
            const response: JsonRpcResponse = JSON.parse(event.data);
            const pending = this.pendingRequests.get(response.id);
            if (pending) {
              this.pendingRequests.delete(response.id);
              if (response.error) {
                pending.reject(response.error);
              } else {
                pending.resolve(response.result);
              }
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
            setTimeout(() => this.connect(), 3000);
          }
        };
      } catch (err) {
        reject(err);
      }
    });

    return this.connectionPromise;
  }

  public async listTools(): Promise<McpTool[]> {
    const result = await this.request('tools/list', {});
    return result.tools || [];
  }

  public async callTool(name: string, args: any): Promise<any> {
    return this.request('tools/call', { name, arguments: args });
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
