export type RuntimeInstanceId = string;
export type ServiceId = string;
export type LiveStatus = 'unknown' | 'active' | 'inactive';

export interface ServiceMetadata {
  environment: string;
  version: string;
  protocol: string;
  port: number;
  address: string;
  tags: Record<string, string>;
}

export interface RuntimeInstance {
  runtimeInstanceId: RuntimeInstanceId;
  serviceId: ServiceId;
  envTag?: string;
  metadata: ServiceMetadata;
  connectedAt: string;
  lastSeenAt: string;
  connected: boolean;
  active: boolean;
  liveStatus?: LiveStatus;
}

/** DB-style shape from REST (getRuntimeInstance) */
export interface RuntimeInstanceType {
  hostId: string;
  runtimeInstanceId: string;
  serviceId: string;
  envTag?: string;
  protocol: string;
  ipAddress: string;
  portNumber: number;
  instanceStatus: string;
  aggregateVersion?: number;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
}

export interface RuntimeInstanceApiResponse {
  runtimeInstances: RuntimeInstanceType[];
  total: number;
}

export type PortalEvent =
  | { type: 'instance_connected'; instance: RuntimeInstance }
  | { 
      type: 'instance_disconnected'; 
      runtimeInstanceId: RuntimeInstanceId; 
      serviceId: ServiceId; 
      disconnectedAt: string;
    }
  | { type: 'instance_updated'; instance: RuntimeInstance }
  | {
      type: 'command_completed';
      runtime_instance_id: RuntimeInstanceId;
      request_id: string;
      completed_at: string;
      result: any;
    }
  | {
      type: 'command_failed';
      runtime_instance_id: RuntimeInstanceId;
      request_id: string;
      completed_at: string;
      error: any;
    }
  | {
      type: 'command_timed_out';
      runtime_instance_id: RuntimeInstanceId;
      request_id: string;
      timed_out_at: string;
    };

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/** 
 * Real JSON-RPC 2.0 Response must have an id (even if null on error).
 * We keep result/error optional as they are mutually exclusive.
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/** Union type for all incoming MCP messages */
export type JsonRpcMessage = JsonRpcResponse | JsonRpcNotification;
