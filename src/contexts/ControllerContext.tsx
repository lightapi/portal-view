import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { McpClient } from '../controller/mcpClient';
import Cookies from 'universal-cookie';
import { useUserState } from './UserContext';

interface ControllerState {
  isLiveConnected: boolean; // Unified status
  error: string | null;
}

type ControllerAction =
  | { type: 'SET_LIVE_STATUS'; connected: boolean }
  | { type: 'SET_ERROR'; error: string | null };

const initialState: ControllerState = {
  isLiveConnected: false,
  error: null,
};

function controllerReducer(state: ControllerState, action: ControllerAction): ControllerState {
  switch (action.type) {
    case 'SET_LIVE_STATUS':
      return { ...state, isLiveConnected: action.connected };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

type ControllerNotificationHandler = (method: string, params: any) => void;

interface ControllerContextValue extends ControllerState {
  callTool: (name: string, args: any) => Promise<any>;
  subscribeToNotifications: (handler: ControllerNotificationHandler) => () => void;
}

const ControllerContext = createContext<ControllerContextValue | undefined>(undefined);

export function ControllerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(controllerReducer, initialState);
  const { isAuthenticated, host } = useUserState() as { isAuthenticated: boolean, host: string };

  const mcpClientRef = useRef<McpClient | null>(null);
  const notificationHandlersRef = useRef(new Set<ControllerNotificationHandler>());

  useEffect(() => {
    if (!isAuthenticated) return;

    // Follow the same BFF connection pattern as Chat.tsx:
    // The accessToken is in cookies and automatically sent with the WebSocket upgrade request.
    // The csrf token is passed via Sec-WebSocket-Protocol header for BFF validation.
    const cookies = new Cookies();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const mcpUrlObject = new URL('/ctrl/mcp', window.location.href);
    mcpUrlObject.protocol = protocol;
    const mcpUrl = mcpUrlObject.toString();
    const mcpClient = new McpClient(mcpUrl, () => {
      const token = cookies.get('csrf');
      return token ? [`csrf.${token}`] : [];
    });
    mcpClientRef.current = mcpClient;

    let ignore = false;

    const init = async () => {
      mcpClient.onOpen(() => {
        if (ignore) return;
        dispatch({ type: 'SET_LIVE_STATUS', connected: true });
        dispatch({ type: 'SET_ERROR', error: null });
        console.log('Unified Control Plane connected (/ctrl/mcp)');
      });

      mcpClient.onClose(() => {
        if (ignore) return;
        dispatch({ type: 'SET_LIVE_STATUS', connected: false });
        console.log('Unified Control Plane disconnected');
      });

      // Register MCP client error handler
      mcpClient.onError((err) => {
        if (ignore) return;
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
        if (ignore) return;
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
        if (ignore) return;
        dispatch({ type: 'SET_ERROR', error: `Control Plane initialization failed: ${err.message}` });
        console.error('Control Plane initialization failed:', err);
      }
    };

    init();

    return () => {
      ignore = true;
      mcpClient.close();
      dispatch({ type: 'SET_LIVE_STATUS', connected: false });
    };
  }, [isAuthenticated, host]);

  const callTool = useCallback(async (name: string, args: any) => {
    if (!mcpClientRef.current) throw new Error('Control Plane not initialized');
    return mcpClientRef.current.callTool(name, args);
  }, []);

  const subscribeToNotifications = useCallback((handler: ControllerNotificationHandler) => {
    notificationHandlersRef.current.add(handler);
    return () => {
      notificationHandlersRef.current.delete(handler);
    };
  }, []);

  const value: ControllerContextValue = {
    ...state,
    callTool,
    subscribeToNotifications,
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
