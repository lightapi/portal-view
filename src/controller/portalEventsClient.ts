import { PortalEvent } from './types';

export class PortalEventsClient {
  private socket: WebSocket | null = null;
  private reconnectTimeout = 1000;
  private maxReconnectTimeout = 30000;
  private shouldReconnect = true;
  private onMessageCallback: (event: PortalEvent) => void = () => {};
  private onOpenCallback?: () => void;
  private onCloseCallback?: () => void;
  private onErrorCallback?: (err: any) => void;

  private connectionPromise: Promise<void> | null = null;

  constructor(private url: string) {}

  public onMessage(callback: (event: PortalEvent) => void) {
    this.onMessageCallback = callback;
  }

  public onOpen(cb: () => void) { this.onOpenCallback = cb; }
  public onClose(cb: () => void) { this.onCloseCallback = cb; }
  public onError(cb: (err: any) => void) { this.onErrorCallback = cb; }

  public async connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;
    this.shouldReconnect = true;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;

      socket.onopen = () => {
        console.log('Portal events connected');
        this.reconnectTimeout = 1000;
        this.onOpenCallback?.();
        resolve();
      };

      socket.onmessage = (event) => {
        try {
          const portalEvent: PortalEvent = JSON.parse(event.data);
          this.onMessageCallback(portalEvent);
        } catch (err) {
          console.error('Failed to parse portal event', err);
        }
      };

      socket.onclose = () => {
        this.socket = null;
        this.connectionPromise = null;
        this.onCloseCallback?.();
        
        if (this.shouldReconnect) {
          console.log(`Portal events disconnected, retrying in ${this.reconnectTimeout}ms`);
          setTimeout(() => {
            if (!this.shouldReconnect) return;
            this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, this.maxReconnectTimeout);
            this.connect();
          }, this.reconnectTimeout);
        }
      };

      socket.onerror = (err) => {
        console.error('Portal events socket error', err);
        this.onErrorCallback?.(err);
        socket.close();
        reject(err);
      };
    });

    return this.connectionPromise;
  }

  public close() {
    this.shouldReconnect = false;
    this.socket?.close();
  }
}
