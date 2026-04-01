import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { McpClient } from '../controller/mcpClient';
import { RuntimeInstance, RuntimeInstanceId, RuntimeInstanceType, RuntimeInstanceApiResponse } from '../controller/types';
import Cookies from 'universal-cookie';
import { useUserState } from './UserContext';
import fetchClient from '../utils/fetchClient';

const mapDbToRuntimeInstance = (db: RuntimeInstanceType): RuntimeInstance => ({
  runtimeInstanceId: db.runtimeInstanceId,
  serviceId: db.serviceId,
  envTag: db.envTag,
  connected: false, // Baseline from DB is disconnected unless controller says otherwise
  connectedAt: db.updateTs || '',
  lastSeenAt: db.updateTs || '',
  metadata: {
    address: db.ipAddress,
    port: db.portNumber,
    protocol: db.protocol,
    environment: db.envTag || '',
    version: '0.1.0', // Default if missing
    tags: {}
  }
});

interface ControllerState {
  instances: Record<RuntimeInstanceId, RuntimeInstance>;
  isLiveConnected: boolean; // Unified status
  error: string | null;
}

type ControllerAction =
  | { type: 'SET_INSTANCES'; instances: RuntimeInstance[] }
  | { type: 'UPDATE_INSTANCE'; instance: RuntimeInstance }
  | { type: 'MARK_OFFLINE'; runtimeInstanceId: RuntimeInstanceId }
  | { type: 'SET_LIVE_STATUS'; connected: boolean }
  | { type: 'SET_ERROR'; error: string | null };

const initialState: ControllerState = {
  instances: {},
  isLiveConnected: false,
  error: null,
};

function controllerReducer(state: ControllerState, action: ControllerAction): ControllerState {
  switch (action.type) {
    case 'SET_INSTANCES':
      const instancesMap: Record<RuntimeInstanceId, RuntimeInstance> = {};
      action.instances.forEach((inst) => {
        instancesMap[inst.runtimeInstanceId] = inst;
      });
      return { ...state, instances: instancesMap };
    case 'UPDATE_INSTANCE':
      return {
        ...state,
        instances: {
          ...state.instances,
          [action.instance.runtimeInstanceId]: action.instance,
        },
      };
    case 'MARK_OFFLINE':
      const existing = state.instances[action.runtimeInstanceId];
      if (!existing) return state;
      return {
        ...state,
        instances: {
          ...state.instances,
          [action.runtimeInstanceId]: { ...existing, connected: false },
        },
      };
    case 'SET_LIVE_STATUS':
      return { ...state, isLiveConnected: action.connected };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

interface ControllerContextValue extends ControllerState {
  callTool: (name: string, args: any) => Promise<any>;
}

const ControllerContext = createContext<ControllerContextValue | undefined>(undefined);

export function ControllerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(controllerReducer, initialState);
  const { isAuthenticated, host } = useUserState() as { isAuthenticated: boolean, host: string };

  const mcpClientRef = useRef<McpClient | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Follow the same BFF connection pattern as Chat.tsx:
    // The accessToken is in cookies and automatically sent with the WebSocket upgrade request.
    // The csrf token is passed via Sec-WebSocket-Protocol header for BFF validation.
    const cookies = new Cookies();
    const csrfToken = cookies.get('csrf');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const mcpUrlObject = new URL('/ctrl/mcp', window.location.href);
    mcpUrlObject.protocol = protocol;
    const mcpUrl = mcpUrlObject.toString();
    // Use Sec-WebSocket-Protocol header for CSRF to avoid URL logging
    const protocols = csrfToken ? [`csrf.${csrfToken}`] : [];

    const mcpClient = new McpClient(mcpUrl, protocols);
    mcpClientRef.current = mcpClient;

    const init = async () => {
      mcpClient.onOpen(() => {
        dispatch({ type: 'SET_LIVE_STATUS', connected: true });
        console.log('Unified Control Plane connected (/ctrl/mcp)');
      });

      mcpClient.onClose(() => {
        dispatch({ type: 'SET_LIVE_STATUS', connected: false });
        console.log('Unified Control Plane disconnected');
      });

      mcpClient.onError((err) => {
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
        if (import.meta.env.DEV) {
          console.debug('MCP Notification:', { method, params });
        }
        
        switch (method) {
          case 'notifications/instance_connected':
          case 'notifications/instance_updated': {
            const rawPayload =
              params && typeof params === 'object' && 'instance' in params
                ? (params as any).instance
                : params;

            const runtimeInstanceId =
              rawPayload && typeof rawPayload === 'object'
                ? (rawPayload as any).runtimeInstanceId || (rawPayload as any).runtime_instance_id
                : undefined;

            if (!rawPayload || typeof rawPayload !== 'object' || !runtimeInstanceId) {
              console.warn('Ignoring invalid instance notification:', { method, params });
              break;
            }

            // Normalize and validate with fallbacks to prevent crashes from partial or missing fields
            const baseInstance = {
              ...rawPayload,
              runtimeInstanceId
            } as RuntimeInstance;

            const normalized: RuntimeInstance = {
              ...baseInstance,
              connected: true, // If we get a connected or updated notification, it's live
              metadata: {
                address: (rawPayload as any).metadata?.address || 'unknown',
                port: (rawPayload as any).metadata?.port || 0,
                protocol: (rawPayload as any).metadata?.protocol || 'http',
                environment: (rawPayload as any).metadata?.environment || (rawPayload as any).envTag || '',
                version: (rawPayload as any).metadata?.version || '0.1.0',
                tags: (rawPayload as any).metadata?.tags || {}
              }
            };

            dispatch({ type: 'UPDATE_INSTANCE', instance: normalized });
            break;
          }
          case 'notifications/instance_disconnected': {
            const runtimeInstanceId =
              params && typeof params === 'object'
                ? params.runtimeInstanceId || (params as any).runtime_instance_id
                : undefined;

            if (!runtimeInstanceId) {
              console.warn('Ignoring invalid disconnect notification (missing ID):', { method, params });
              break;
            }

            dispatch({ type: 'MARK_OFFLINE', runtimeInstanceId });
            break;
          }
          default:
            break;
        }
      });

      try {
        // 1. Baseline from DB (shows recent history)
        const cmd = {
          host: 'lightapi.net',
          service: 'instance',
          action: 'getRuntimeInstance',
          version: '0.1.0',
          data: {
            hostId: host,
            offset: 0,
            limit: 1000,
            sorting: JSON.stringify([]),
            filters: JSON.stringify([{ id: 'active', value: true }]),
            globalFilter: '',
            active: true,
          },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        const dbResponse = await fetchClient(url) as RuntimeInstanceApiResponse;
        const dbInstances = dbResponse.runtimeInstances || [];

        console.log(`Hydro-Step 1: Loaded ${dbInstances.length} instances from DB baseline`);
        dispatch({ type: 'SET_INSTANCES', instances: dbInstances.map(mapDbToRuntimeInstance) });

        // 2. Connect to MCP Control Plane
        console.log('Hydro-Step 2: Connecting to Unified Control Plane...');
        await mcpClient.connect();

        // 3. Live Hydration: Fetch live snapshot to overlay connectivity onto DB baseline
        console.log('Hydro-Step 3: Fetching live instances from Control Plane...');
        const liveSnapshot = await mcpClient.callTool('list_instances', {});
        if (liveSnapshot && Array.isArray(liveSnapshot.instances)) {
          console.log(`Hydro-Step 3: Synced ${liveSnapshot.instances.length} live instances`);
          liveSnapshot.instances.forEach((inst: RuntimeInstance) => {
            dispatch({ type: 'UPDATE_INSTANCE', instance: inst });
          });
        }

      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: `Hydration failed: ${err.message}` });
        console.error('Hydration Error:', err);
      }
    };

    init();

    return () => {
      mcpClient.close();
      dispatch({ type: 'SET_LIVE_STATUS', connected: false });
    };
  }, [isAuthenticated, host]);

  const callTool = useCallback(async (name: string, args: any) => {
    if (!mcpClientRef.current) throw new Error('Control Plane not initialized');
    return mcpClientRef.current.callTool(name, args);
  }, []);

  const value: ControllerContextValue = {
    ...state,
    callTool,
  };

  return <ControllerContext.Provider value={value}>{children}</ControllerContext.Provider>;
}

export function useController() {
  const context = useContext(ControllerContext);
  if (context === undefined) {
    throw new Error('useController must be used within a ControllerProvider');
  }
  return context;
}
