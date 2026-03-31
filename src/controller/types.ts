export type RuntimeInstanceId = string;
export type ServiceId = string;

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

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
