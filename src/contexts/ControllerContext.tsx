import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { McpClient } from '../controller/mcpClient';
import { PortalEventsClient } from '../controller/portalEventsClient';
import { RuntimeInstance, RuntimeInstanceId, PortalEvent, RuntimeInstanceType, RuntimeInstanceApiResponse } from '../controller/types';
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
  isMcpConnected: boolean;
  isEventsConnected: boolean;
  error: string | null;
}

type ControllerAction =
  | { type: 'SET_INSTANCES'; instances: RuntimeInstance[] }
  | { type: 'UPDATE_INSTANCE'; instance: RuntimeInstance }
  | { type: 'MARK_OFFLINE'; runtimeInstanceId: RuntimeInstanceId }
  | { type: 'SET_MCP_STATUS'; connected: boolean }
  | { type: 'SET_EVENTS_STATUS'; connected: boolean }
  | { type: 'SET_ERROR'; error: string | null };

const initialState: ControllerState = {
  instances: {},
  isMcpConnected: false,
  isEventsConnected: false,
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
    case 'SET_MCP_STATUS':
      return { ...state, isMcpConnected: action.connected };
    case 'SET_EVENTS_STATUS':
      return { ...state, isEventsConnected: action.connected };
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
  const eventsClientRef = useRef<PortalEventsClient | null>(null);

  const getWsUrl = (path: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${path}`;
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const mcpUrl = getWsUrl('/ws/mcp');
    const eventsUrl = getWsUrl('/ws/portal-events');

    const mcpClient = new McpClient(mcpUrl);
    const eventsClient = new PortalEventsClient(eventsUrl);

    mcpClientRef.current = mcpClient;
    eventsClientRef.current = eventsClient;

    const init = async () => {
      mcpClient.onOpen(() => {
        // Status is handled after hydration
      });
      mcpClient.onClose(() => dispatch({ type: 'SET_MCP_STATUS', connected: false }));
      mcpClient.onError((err) => dispatch({ type: 'SET_ERROR', error: `MCP Error: ${err.message || err}` }));

      eventsClient.onOpen(() => dispatch({ type: 'SET_EVENTS_STATUS', connected: true }));
      eventsClient.onClose(() => dispatch({ type: 'SET_EVENTS_STATUS', connected: false }));
      eventsClient.onError((err) => dispatch({ type: 'SET_ERROR', error: `Events Error: ${err.message || err}` }));

      try {
        // 1. Concurrent Fetch: DB Baseline (REST) and MCP Handshake (WebSocket)
        const dbPromise = (async () => {
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
          const response = await fetchClient(url) as RuntimeInstanceApiResponse;
          return response.runtimeInstances || [];
        })();

        const mcpConnectPromise = mcpClient.connect();

        // Wait for both baseline and connection
        const [dbInstances] = await Promise.all([dbPromise, mcpConnectPromise]);

        // 2. Fetch Live Status (MCP)
        const services = await mcpClient.callTool('list_services', {});
        const liveInstances: RuntimeInstance[] = services.instances || [];

        // 3. Merge Strategy: DB baseline + MCP live status
        const merged: RuntimeInstance[] = dbInstances.map(mapDbToRuntimeInstance);
        const mergedMap = new Map<RuntimeInstanceId, RuntimeInstance>(
          merged.map(i => [i.runtimeInstanceId, i])
        );

        // Overlay live status
        liveInstances.forEach(live => {
          mergedMap.set(live.runtimeInstanceId, live);
        });

        dispatch({ type: 'SET_INSTANCES', instances: Array.from(mergedMap.values()) });
        dispatch({ type: 'SET_MCP_STATUS', connected: true });

      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: `Hydration failed: ${err.message}` });
      }
    };

    eventsClient.onMessage((event: PortalEvent) => {
      switch (event.type) {
        case 'instance_connected':
        case 'instance_updated':
          dispatch({ type: 'UPDATE_INSTANCE', instance: event.instance });
          break;
        case 'instance_disconnected':
          dispatch({ type: 'MARK_OFFLINE', runtimeInstanceId: event.runtimeInstanceId });
          break;
        case 'command_completed':
          // Handle global command completion if needed (e.g. notifications)
          break;
        default:
          break;
      }
    });

    init();
    eventsClient.connect();

    return () => {
      mcpClient.close();
      eventsClient.close();
      dispatch({ type: 'SET_MCP_STATUS', connected: false });
      dispatch({ type: 'SET_EVENTS_STATUS', connected: false });
    };
  }, [isAuthenticated]);

  const callTool = useCallback(async (name: string, args: any) => {
    if (!mcpClientRef.current) throw new Error('MCP Client not initialized');
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
