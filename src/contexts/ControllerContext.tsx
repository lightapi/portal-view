import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { McpClient } from '../controller/mcpClient';
import { RuntimeInstance, RuntimeInstanceId, RuntimeInstanceType, RuntimeInstanceApiResponse } from '../controller/types';
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

  const getWsUrl = (path: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${path}`;
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const mcpUrl = getWsUrl('/ctrl/mcp');
    const mcpClient = new McpClient(mcpUrl);
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
        dispatch({ type: 'SET_ERROR', error: `Control Plane Error: ${err.message || err}` });
      });

      mcpClient.onNotification((method, params: any) => {
        console.log('Received Control Plane Notification:', { method, params });
        switch (method) {
          case 'notifications/instance_connected':
          case 'notifications/instance_updated': {
            // Normalize params: the server might send the RuntimeInstance directly or wrapped in { instance: ... }
            const instancePayload =
              params && typeof params === 'object' && 'instance' in params
                ? (params as any).instance
                : params;

            if (
              !instancePayload ||
              typeof instancePayload !== 'object' ||
              !('runtimeInstanceId' in (instancePayload as any)) ||
              !(instancePayload as any).runtimeInstanceId
            ) {
              console.warn(
                'Ignoring invalid instance notification payload',
                { method, params }
              );
              break;
            }

            dispatch({ type: 'UPDATE_INSTANCE', instance: instancePayload });
            break;
          }
          case 'notifications/instance_disconnected': {
            // Params should contain runtimeInstanceId, potentially wrapped
            const runtimeInstanceId =
              params && typeof params === 'object'
                ? (params as any).runtimeInstanceId || (params as any).runtime_instance_id
                : undefined;

            if (!runtimeInstanceId) {
              console.warn(
                'Ignoring invalid disconnect notification payload (missing runtimeInstanceId)',
                { method, params }
              );
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
        // 1. Immediate Baseline from DB (REST)
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

        // 2. Control Plane Connection (includes live hydration check if needed)
        console.log('Hydro-Step 2: Connecting to Unified Control Plane...');
        await mcpClient.connect();

        // 3. Optional: Verify with server_info
        const info = await mcpClient.callTool('server_info', {});
        console.log('Hydro-Step 3: Control Plane Info:', info);

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
