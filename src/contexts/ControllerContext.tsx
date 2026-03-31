import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { McpClient } from '../controller/mcpClient';
import { PortalEventsClient } from '../controller/portalEventsClient';
import { RuntimeInstance, RuntimeInstanceId, PortalEvent } from '../controller/types';
import { useUserState } from './UserContext';

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
  const { isAuthenticated } = useUserState();
  
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
      try {
        await mcpClient.connect();
        dispatch({ type: 'SET_MCP_STATUS', connected: true });

        // Initial hydration
        const services = await mcpClient.callTool('list_services', {});
        if (services.instances) {
          dispatch({ type: 'SET_INSTANCES', instances: services.instances });
        }
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: `MCP Connection failed: ${err.message}` });
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
    dispatch({ type: 'SET_EVENTS_STATUS', connected: true }); // Assuming connect() starts the process

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
