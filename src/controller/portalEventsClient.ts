import { PortalEvent } from './types';

export class PortalEventsClient {
  private socket: WebSocket | null = null;
  private reconnectTimeout = 1000;
  private maxReconnectTimeout = 30000;
  private onMessageCallback: (event: PortalEvent) => void = () => {};

  constructor(private url: string) {}

  public onMessage(callback: (event: PortalEvent) => void) {
    this.onMessageCallback = callback;
  }

  public connect() {
    if (this.socket) return;

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      console.log('Portal events connected');
      this.reconnectTimeout = 1000;
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
      console.log(`Portal events disconnected, retrying in ${this.reconnectTimeout}ms`);
      setTimeout(() => {
        this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, this.maxReconnectTimeout);
        this.connect();
      }, this.reconnectTimeout);
    };

    socket.onerror = (err) => {
      console.error('Portal events socket error', err);
      socket.close();
    };
  }

  public close() {
    this.socket?.close();
  }
}
