import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ActionDisplay = 'menu' | 'expanded';
export const ACTION_DISPLAY_KEY = 'portal.actionDisplay.v1';
const parseMode = (value: string | null): ActionDisplay => value === 'expanded' ? 'expanded' : 'menu';

function initialMode(): ActionDisplay {
  try { return parseMode(localStorage.getItem(ACTION_DISPLAY_KEY)); }
  catch { return 'menu'; }
}

const ActionDisplayContext = createContext<{ mode: ActionDisplay; setMode: (mode: ActionDisplay) => void } | undefined>(undefined);

/** One presentation preference for the browser origin, independent of the signed-in user. */
export function ActionDisplayProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState(initialMode);
  const setMode = useCallback((next: ActionDisplay) => {
    updateMode(next);
    try { localStorage.setItem(ACTION_DISPLAY_KEY, next); }
    catch { /* Storage may be disabled; the current session still updates. */ }
  }, []);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ACTION_DISPLAY_KEY) return;
      // Do not accept sessionStorage events. Synthetic events may omit storageArea.
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
      catch { return; }
      updateMode(parseMode(event.key === null ? null : event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ActionDisplayContext.Provider value={value}>{children}</ActionDisplayContext.Provider>;
}

export function useActionDisplay() {
  const context = useContext(ActionDisplayContext);
  if (!context) throw new Error('useActionDisplay must be inside an ActionDisplayProvider');
  return context;
}
