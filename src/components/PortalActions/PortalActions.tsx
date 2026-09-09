import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { Box, Button, CircularProgress, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useActionDisplay } from '../../contexts/ActionDisplayContext';

export type PortalAction<T> = {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  destructive?: boolean;
  hidden?: (row: T) => boolean;
  disabledReason?: (row: T) => string | null;
  loading?: (row: T) => boolean;
  onSelect: (row: T) => void;
};

type ResolvedAction = {
  id: string; label: string; description?: string; icon: ReactNode; destructive?: boolean;
  reason: string | null; loading: boolean; select: () => void;
};
type ActionSource = { current: ResolvedAction[] };
type OpenMenu = { id: string; anchor: HTMLElement; source: ActionSource };
type MenuController = {
  menuId: string;
  activeId: string | null;
  open: (menu: OpenMenu) => void;
  refresh: (id: string) => void;
  release: (id: string) => void;
  measure: (id: string, width: number | null) => void;
};
const MenuContext = createContext<MenuController | null>(null);

/** Wrap a table or toolbar once; every action trigger shares this menu. */
export function PortalActionScope({ children }: { children: ReactNode }) {
  const { mode } = useActionDisplay();
  const menuId = useId();
  const [active, setActive] = useState<OpenMenu | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [, updateItems] = useState(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  const widths = useRef(new Map<string, number>());
  const [columnWidth, setColumnWidth] = useState(80);
  const measure = useCallback((id: string, width: number | null) => {
    if (width === null) widths.current.delete(id);
    else widths.current.set(id, width);
    setColumnWidth(Math.max(80, ...Array.from(widths.current.values())));
  }, []);
  const pending = useRef<{ source: ActionSource; id: string } | null>(null);
  const close = useCallback(() => { setOpen(false); }, []);
  const controller = useMemo<Omit<MenuController, 'activeId'>>(() => ({
    menuId, measure,
    open: next => { pending.current = null; setActive(next); setOpen(true); },
    refresh: id => {
      const current = activeRef.current;
      if (current?.id !== id) return;
      if (!current.source.current.length || !current.anchor.isConnected) {
        pending.current = null; setOpen(false); setActive(null);
      } else updateItems(value => value + 1);
    },
    release: id => {
      if (activeRef.current?.id === id) { pending.current = null; setOpen(false); setActive(null); }
    },
  }), [menuId, measure]);
  const context = useMemo(() => ({ ...controller, activeId: isOpen ? active?.id ?? null : null }), [controller, isOpen, active?.id]);
  useEffect(() => { pending.current = null; setOpen(false); }, [mode]);
  const finishClose = () => {
    const selected = pending.current;
    pending.current = null;
    setActive(null);
    // The menu has finished closing and restoring focus before a dialog can mount.
    const action = selected?.source.current.find(item => item.id === selected.id);
    if (action && !action.reason && !action.loading) action.select();
  };
  const items = active?.source.current ?? [];
  const firstDestructive = items.findIndex(action => action.destructive);
  return <MenuContext.Provider value={context}>
    <Box sx={{ display: 'contents', '& [data-portal-action-cell]': mode === 'expanded' ? {
      width: '1%', minWidth: columnWidth, maxWidth: columnWidth,
      '&[data-portal-action-grid="true"]': { width: columnWidth, flex: '0 0 auto' },
    } : {} }}>{children}</Box>
    <Menu id={menuId} anchorEl={active?.anchor ?? null} open={isOpen && mode === 'menu' && Boolean(active)}
      onClose={close} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
      slotProps={{
        transition: { onExited: finishClose },
        paper: { sx: { maxWidth: 'min(420px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)' } },
        list: { 'aria-label': 'Available actions' },
      }}>
      {items.map((action, index) => [
        index === firstDestructive && index > 0 ? <Divider key={`${action.id}-divider`} /> : null,
        <MenuItem key={action.id} disabled={Boolean(action.reason) || action.loading}
          aria-label={action.label}
          aria-describedby={action.reason || action.description ? `${menuId}-${action.id}-description` : undefined}
          onClick={() => { pending.current = { source: active!.source, id: action.id }; close(); }}
          sx={{ alignItems: 'flex-start', whiteSpace: 'normal', ...(action.destructive ? { color: 'error.main' } : {}) }}>
          <ListItemIcon sx={{ mt: 0.5, color: 'inherit' }}>
            {action.loading ? <CircularProgress size={18} aria-label="Action in progress" /> : action.icon}
          </ListItemIcon>
          <ListItemText primary={action.label} secondary={action.reason ?? action.description}
            slotProps={{ secondary: { id: `${menuId}-${action.id}-description`, sx: { overflowWrap: 'anywhere' } } }} />
        </MenuItem>,
      ])}
    </Menu>
  </MenuContext.Provider>;
}

export function PortalActions<T>({ row, actions, label = 'Actions' }: {
  row: T; actions: readonly PortalAction<T>[]; label?: string;
}) {
  const scope = useContext(MenuContext);
  const { mode } = useActionDisplay();
  const id = useId();
  const resolved = useMemo(() => {
    const visible = actions.filter(action => !action.hidden?.(row)).map(action => {
      const loading = Boolean(action.loading?.(row));
      return {
        ...action, loading, reason: action.disabledReason?.(row) || (loading ? 'Action in progress.' : null),
        select: () => action.onSelect(row),
      };
    });
    return [...visible.filter(action => !action.destructive), ...visible.filter(action => action.destructive)];
  }, [actions, row]);
  const expandedGroup = useRef<HTMLDivElement>(null);
  const measure = scope?.measure;
  const hasActions = resolved.length > 0;
  useLayoutEffect(() => {
    const group = expandedGroup.current;
    const cell = group?.closest('td');
    if (mode !== 'expanded' || !group || !cell || !measure) return;
    const update = () => {
      const style = getComputedStyle(cell);
      measure(id, Math.ceil(group.getBoundingClientRect().width
        + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)));
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(group);
    // Cell sizing is an output of this measurement, so do not resize-observe it.
    // Density/theme padding changes arrive through the cell's class/style instead.
    const paddingObserver = new MutationObserver(update);
    paddingObserver.observe(cell, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => { observer?.disconnect(); paddingObserver.disconnect(); measure(id, null); };
  }, [mode, hasActions, measure, id]);
  const source = useRef<ResolvedAction[]>(resolved);
  const refresh = scope?.refresh;
  const release = scope?.release;
  useLayoutEffect(() => { source.current = resolved; refresh?.(id); }, [resolved, refresh, id]);
  useEffect(() => () => release?.(id), [release, id]);
  if (!scope) throw new Error('PortalActions must be inside a PortalActionScope');
  if (!resolved.length) return null;
  if (mode === 'menu') return <Button size="small" variant="outlined" endIcon={<ArrowDropDownIcon />}
    aria-label={label} aria-haspopup="menu" aria-controls={scope.activeId === id ? scope.menuId : undefined}
    aria-expanded={scope.activeId === id}
    onClick={event => { event.stopPropagation(); scope.open({ id, anchor: event.currentTarget, source }); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); scope.open({ id, anchor: event.currentTarget, source });
      }
    }} sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}>{label}</Button>;
  return <Box ref={expandedGroup} sx={{ display: 'flex', flexWrap: 'nowrap', gap: '0.1rem', alignItems: 'center', width: 'max-content', flexShrink: 0 }}
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    {resolved.map(action => <Tooltip key={action.id} title={action.reason ?? action.description ?? action.label}>
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>
        <IconButton color={action.destructive ? 'error' : 'default'} aria-label={action.label}
          disabled={Boolean(action.reason) || action.loading}
          onClick={event => { event.stopPropagation(); action.select(); }}>
          {action.loading ? <CircularProgress size={22} aria-label="Action in progress" /> : action.icon}
        </IconButton>
      </span>
    </Tooltip>)}
  </Box>;
}
