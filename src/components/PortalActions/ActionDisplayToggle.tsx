import { Check, ViewList } from '@mui/icons-material';
import { ListItemIcon, ListItemText, MenuItem, type MenuItemProps } from '@mui/material';
import { useActionDisplay } from '../../contexts/ActionDisplayContext';

/** A direct, keyboard-navigable item in the header profile menu. */
export function ActionDisplayToggle(props: MenuItemProps) {
  const { mode, setMode } = useActionDisplay();
  const expanded = mode === 'expanded';
  return <MenuItem {...props} role="menuitemcheckbox" aria-checked={expanded}
    aria-label="Expanded buttons" onClick={event => {
      event.stopPropagation();
      setMode(expanded ? 'menu' : 'expanded');
    }}>
    <ListItemIcon>{expanded ? <Check /> : <ViewList />}</ListItemIcon>
    <ListItemText primary="Expanded buttons" secondary="Action display · Applies to all pages" />
  </MenuItem>;
}
