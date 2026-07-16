import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback, useState } from 'react';
import {
  McpClient,
  McpClientError,
  McpConnectionState,
  McpRequestOptions,
  mutationInterruptionError,
} from '../controller/mcpClient';
import { McpTool } from '../controller/types';
import {
  normalizeRuntimeCapabilities,
  RuntimeCapabilities,
  RUNTIME_CAPABILITIES_UNAVAILABLE,
} from '../controller/capabilities';
import Cookies from 'universal-cookie';
import { useUserState } from './UserContext';
import { config } from '../../config';

interface ControllerState {
  isLiveConnected: boolean; // Unified status
  error: string | null;
  connectionState: McpConnectionState;
  connectionGeneration: number;
  capabilityRevision: number;
  pendingRequestCount: number;
}

type ControllerAction =
  | { type: 'SET_LIVE_STATUS'; connected: boolean }
  | { type: 'SET_CONNECTION_STATE'; state: McpConnectionState }
  | { type: 'SET_CONNECTION_GENERATION'; generation: number }
  | { type: 'BUMP_CAPABILITY_REVISION' }
  | { type: 'REQUEST_STARTED' }
  | { type: 'REQUEST_FINISHED' }
  | { type: 'SET_ERROR'; error: string | null };

const initialState: ControllerState = {
  isLiveConnected: false,
  error: null,
  connectionState: 'idle',
  connectionGeneration: 0,
  capabilityRevision: 0,
  pendingRequestCount: 0,
};

function controllerReducer(state: ControllerState, action: ControllerAction): ControllerState {
  switch (action.type) {
    case 'SET_LIVE_STATUS':
      return { ...state, isLiveConnected: action.connected };
    case 'SET_CONNECTION_STATE':
      return { ...state, connectionState: action.state };
    case 'SET_CONNECTION_GENERATION':
      return { ...state, connectionGeneration: action.generation };
    case 'BUMP_CAPABILITY_REVISION':
      return { ...state, capabilityRevision: state.capabilityRevision + 1 };
    case 'REQUEST_STARTED':
      return { ...state, pendingRequestCount: state.pendingRequestCount + 1 };
    case 'REQUEST_FINISHED':
      return { ...state, pendingRequestCount: Math.max(0, state.pendingRequestCount - 1) };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

type ControllerNotificationHandler = (method: string, params: any) => void;
type ControllerRehydrationHandler = (generation: number) => void | Promise<void>;
type ReadyClientWaiter = {
  resolve: (client: McpClient) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const UNAVAILABLE_REASON = RUNTIME_CAPABILITIES_UNAVAILABLE;
const RUNTIME_TOOLS = new Set([
  'get_service_info', 'check', 'get_loggers', 'get_logging_filter', 'set_loggers',
  'set_logging_filter', 'get_log_content', 'start_logs', 'stop_logs', 'get_modules',
  'reload_modules', 'list_caches', 'get_cache_entries', 'clear_cache', 'shutdown_service',
  'get_chaos_monkey', 'get_chaos_monkey_config', 'configure_chaos_monkey',
  'run_chaos_monkey_assault',
]);

interface ControllerContextValue extends ControllerState {
  callTool: (name: string, args: any, options?: McpRequestOptions) => Promise<any>;
  getRuntimeCapabilities: (runtimeInstanceId: string, force?: boolean) => Promise<RuntimeCapabilities>;
  controllerTools: ReadonlySet<string>;
  subscribeToNotifications: (handler: ControllerNotificationHandler) => () => void;
  subscribeToRehydration: (handler: ControllerRehydrationHandler) => () => void;
  requestConnection: () => void;
  releaseConnection: () => void;
}

const ControllerContext = createContext<ControllerContextValue | undefined>(undefined);
const MCP_ENDPOINT = '/ctrl/mcp';

function buildMcpUrl(): string {
  const configuredBaseUrl = (config.apiBaseUrl || '').trim();
  const useDevProxy = import.meta.env.DEV && MCP_ENDPOINT.startsWith('/');
  const httpUrl = (useDevProxy || !configuredBaseUrl)
    ? new URL(MCP_ENDPOINT, window.location.href).toString()
    : `${configuredBaseUrl.replace(/\/+$/, '')}${MCP_ENDPOINT}`;
  const mcpUrl = new URL(httpUrl, window.location.href);
  if (mcpUrl.protocol === 'https:') {
    mcpUrl.protocol = 'wss:';
  } else if (mcpUrl.protocol === 'http:') {
    mcpUrl.protocol = 'ws:';
  }
  return mcpUrl.toString();
}

export function ControllerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(controllerReducer, initialState);
  const { isAuthenticated, host } = useUserState() as { isAuthenticated: boolean, host: string };

  const mcpClientRef = useRef<McpClient | null>(null);
  const readyMcpClientRef = useRef<McpClient | null>(null);
  const readyClientWaitersRef = useRef(new Set<ReadyClientWaiter>());
  const activeClientIdRef = useRef(0);
  const notificationHandlersRef = useRef(new Set<ControllerNotificationHandler>());
  const rehydrationHandlersRef = useRef(new Set<ControllerRehydrationHandler>());
  const runtimeCapabilitiesRef = useRef(new Map<string, Promise<RuntimeCapabilities>>());
  const controllerToolsRef = useRef(new Set<string>());
  const [controllerTools, setControllerTools] = useState<ReadonlySet<string>>(new Set());

  const connectionCountRef = useRef(0);
  const [shouldConnect, setShouldConnect] = useState(false);

  const requestConnection = useCallback(() => {
    connectionCountRef.current += 1;
    if (connectionCountRef.current === 1) {
      setShouldConnect(true);
    }
  }, []);

  const releaseConnection = useCallback(() => {
    connectionCountRef.current = Math.max(0, connectionCountRef.current - 1);
    if (connectionCountRef.current === 0) {
      setShouldConnect(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !shouldConnect) return;

    // The accessToken is in cookies and automatically sent with the WebSocket upgrade request.
    // The csrf token is passed via Sec-WebSocket-Protocol header for BFF validation.
    const cookies = new Cookies();

    const mcpUrl = buildMcpUrl();
    const clientCapabilities = new Map<string, Promise<RuntimeCapabilities>>();
    runtimeCapabilitiesRef.current = clientCapabilities;
    const mcpClient = new McpClient(mcpUrl, () => {
      const token = cookies.get('csrf');
      return token ? [`csrf.${token}`] : [];
    });
    mcpClientRef.current = mcpClient;
    readyMcpClientRef.current = null;
    const clientId = activeClientIdRef.current + 1;
    activeClientIdRef.current = clientId;

    let ignore = false;
    const isCurrentClient = () =>
      !ignore && mcpClientRef.current === mcpClient && activeClientIdRef.current === clientId;

    const init = async () => {
      mcpClient.onOpen(() => {
        if (!isCurrentClient()) return;
        dispatch({ type: 'SET_LIVE_STATUS', connected: true });
        dispatch({ type: 'SET_ERROR', error: null });
        console.log('Unified Control Plane connected (/ctrl/mcp)');
      });

      mcpClient.onStateChange((connectionState) => {
        if (!isCurrentClient()) return;
        dispatch({ type: 'SET_CONNECTION_STATE', state: connectionState });
      });

      mcpClient.onReady(async (generation) => {
        if (!isCurrentClient()) return;
        clientCapabilities.clear();
        const tools = await mcpClient.listTools();
        if (!isCurrentClient()) return;
        const toolNames = new Set(tools.map((tool: McpTool) => tool.name));
        controllerToolsRef.current = toolNames;
        setControllerTools(toolNames);
        dispatch({ type: 'SET_CONNECTION_GENERATION', generation });
        readyMcpClientRef.current = mcpClient;
        for (const waiter of Array.from(readyClientWaitersRef.current)) {
          clearTimeout(waiter.timer);
          waiter.resolve(mcpClient);
        }
        readyClientWaitersRef.current.clear();
        for (const handler of Array.from(rehydrationHandlersRef.current)) {
          try {
            await handler(generation);
          } catch {
            // A bounded client reconnect must continue; the page retains its own safe error state.
          }
        }
        for (const runtimeInstanceId of mcpClient.getRequestedStreamRuntimeIds()) {
          const value = await mcpClient.callTool(
            'get_runtime_capabilities',
            { runtimeInstanceId },
            { safeRead: true },
          ).catch(() => null);
          const capability = normalizeRuntimeCapabilities(runtimeInstanceId, value, toolNames);
          clientCapabilities.set(runtimeInstanceId, Promise.resolve(capability));
          if (!capability.tools.includes('start_logs')) {
            mcpClient.removeRequestedStream(runtimeInstanceId);
          }
        }
      });

      mcpClient.onClose(() => {
        if (!isCurrentClient()) return;
        dispatch({ type: 'SET_LIVE_STATUS', connected: false });
        console.log('Unified Control Plane disconnected');
      });

      // Register MCP client error handler
      mcpClient.onError((err) => {
        if (!isCurrentClient()) return;
        let message: string;
        if (err && typeof err === 'object' && 'message' in err && (err as any).message) {
          message = String((err as any).message);
        } else if (typeof err === 'string') {
          message = err;
        } else {
          try {
            message = JSON.stringify(err);
          } catch {
            message = String(err);
          }
        }
        dispatch({ type: 'SET_ERROR', error: `Control Plane Error: ${message}` });
      });

      mcpClient.onNotification((method, params: any) => {
        if (!isCurrentClient()) return;
        if (
          method === 'notifications/runtime_capabilities_changed' ||
          method === 'notifications/instance_updated'
        ) {
          const runtimeInstanceId = params?.runtimeInstanceId ?? params?.runtime_instance_id ??
            params?.instance?.runtimeInstanceId ?? params?.instance?.runtime_instance_id;
          if (typeof runtimeInstanceId === 'string') clientCapabilities.delete(runtimeInstanceId);
          dispatch({ type: 'BUMP_CAPABILITY_REVISION' });
        }
        if (import.meta.env.DEV) {
          console.debug('MCP Notification:', { method, params });
        }
        notificationHandlersRef.current.forEach((handler) => {
          try {
            handler(method, params);
          } catch (error) {
            console.error('Controller notification handler failed', error);
          }
        });
      });

      try {
        dispatch({ type: 'SET_ERROR', error: null });
        await mcpClient.connect();
      } catch (err: any) {
        if (!isCurrentClient()) return;
        dispatch({ type: 'SET_ERROR', error: `Control Plane initialization failed: ${err.message}` });
        console.error('Control Plane initialization failed:', err);
      }
    };

    init();

    return () => {
      ignore = true;
      const isCurrentClient =
        mcpClientRef.current === mcpClient && activeClientIdRef.current === clientId;
      if (isCurrentClient) {
        mcpClientRef.current = null;
        if (readyMcpClientRef.current === mcpClient) readyMcpClientRef.current = null;
        if (runtimeCapabilitiesRef.current === clientCapabilities) clientCapabilities.clear();
        controllerToolsRef.current = new Set();
        setControllerTools(new Set());
        dispatch({ type: 'SET_LIVE_STATUS', connected: false });
      }
      mcpClient.close();
    };
  }, [isAuthenticated, host, shouldConnect]);

  const waitForReadyClient = useCallback((): Promise<McpClient> => {
    const readyClient = readyMcpClientRef.current;
    if (readyClient && readyClient === mcpClientRef.current) return Promise.resolve(readyClient);
    return new Promise((resolve, reject) => {
      const waiter: ReadyClientWaiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          readyClientWaitersRef.current.delete(waiter);
          reject(new McpClientError('timeout', 'Control Plane initialization timed out'));
        }, 10_000),
      };
      readyClientWaitersRef.current.add(waiter);
    });
  }, []);

  const getRuntimeCapabilities = useCallback(async (
    runtimeInstanceId: string,
    force = false,
  ): Promise<RuntimeCapabilities> => {
    if (!runtimeInstanceId) {
      return { runtimeInstanceId, source: 'unavailable', tools: [], reason: UNAVAILABLE_REASON };
    }
    if (force) runtimeCapabilitiesRef.current.delete(runtimeInstanceId);
    const cached = runtimeCapabilitiesRef.current.get(runtimeInstanceId);
    if (cached) return cached;
    const client = await waitForReadyClient().catch(() => null);
    if (!client) {
      return { runtimeInstanceId, source: 'unavailable', tools: [], reason: UNAVAILABLE_REASON };
    }
    const request = client.callTool('get_runtime_capabilities', { runtimeInstanceId }, { safeRead: true })
      .then((value: any): RuntimeCapabilities =>
        normalizeRuntimeCapabilities(runtimeInstanceId, value, controllerToolsRef.current))
      .catch((): RuntimeCapabilities => ({
        runtimeInstanceId,
        source: 'unavailable',
        tools: [],
        reason: UNAVAILABLE_REASON,
      }));
    runtimeCapabilitiesRef.current.set(runtimeInstanceId, request);
    return request;
  }, [waitForReadyClient]);

  const callTool = useCallback(async (name: string, args: any, options?: McpRequestOptions) => {
    dispatch({ type: 'REQUEST_STARTED' });
    try {
      const client = await waitForReadyClient();
      const runtimeInstanceId = typeof args?.runtimeInstanceId === 'string' ? args.runtimeInstanceId : undefined;
      if (runtimeInstanceId && RUNTIME_TOOLS.has(name)) {
        const capabilities = await getRuntimeCapabilities(runtimeInstanceId);
        if (!capabilities.tools.includes(name)) {
          throw new McpClientError('not-supported', capabilities.reason || 'Operation is not supported by this runtime');
        }
      }
      let result: any;
      try {
        result = await client.callTool(name, args, options);
      } catch (error) {
        throw mutationInterruptionError(name, error);
      }
      if (runtimeInstanceId && name === 'reload_modules') {
        runtimeCapabilitiesRef.current.delete(runtimeInstanceId);
        dispatch({ type: 'BUMP_CAPABILITY_REVISION' });
      }
      return result;
    } finally {
      dispatch({ type: 'REQUEST_FINISHED' });
    }
  }, [getRuntimeCapabilities, waitForReadyClient]);

  const subscribeToNotifications = useCallback((handler: ControllerNotificationHandler) => {
    notificationHandlersRef.current.add(handler);
    return () => {
      notificationHandlersRef.current.delete(handler);
    };
  }, []);

  const subscribeToRehydration = useCallback((handler: ControllerRehydrationHandler) => {
    rehydrationHandlersRef.current.add(handler);
    return () => {
      rehydrationHandlersRef.current.delete(handler);
    };
  }, []);

  const value: ControllerContextValue = {
    ...state,
    callTool,
    getRuntimeCapabilities,
    controllerTools,
    subscribeToNotifications,
    subscribeToRehydration,
    requestConnection,
    releaseConnection,
  };

  return <ControllerContext.Provider value={value}>{children}</ControllerContext.Provider>;
}

export function useRuntimeCapabilities(runtimeInstanceId?: string) {
  const { getRuntimeCapabilities, connectionGeneration, capabilityRevision } = useController();
  const [capabilities, setCapabilities] = useState<RuntimeCapabilities>({
    runtimeInstanceId: runtimeInstanceId || '',
    source: 'unavailable',
    tools: [],
    reason: UNAVAILABLE_REASON,
  });
  const [loading, setLoading] = useState(Boolean(runtimeInstanceId));

  useEffect(() => {
    let active = true;
    if (!runtimeInstanceId) {
      setLoading(false);
      setCapabilities({ runtimeInstanceId: '', source: 'unavailable', tools: [], reason: UNAVAILABLE_REASON });
      return () => { active = false; };
    }
    setLoading(true);
    setCapabilities({ runtimeInstanceId, source: 'unavailable', tools: [], reason: UNAVAILABLE_REASON });
    getRuntimeCapabilities(runtimeInstanceId).then((value) => {
      if (active) setCapabilities(value);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [runtimeInstanceId, connectionGeneration, capabilityRevision, getRuntimeCapabilities]);

  return { capabilities, loading, supports: (tool: string) => capabilities.tools.includes(tool) };
}

export function useController() {
  const context = useContext(ControllerContext);
  if (context === undefined) {
    throw new Error('useController must be used within a ControllerProvider');
  }
  return context;
}

export function useControllerConnection() {
  const context = useContext(ControllerContext);
  if (context === undefined) {
    throw new Error('useControllerConnection must be used within a ControllerProvider');
  }
  const { requestConnection, releaseConnection } = context;

  useEffect(() => {
    requestConnection();
    return () => {
      releaseConnection();
    };
  }, [requestConnection, releaseConnection]);
}
