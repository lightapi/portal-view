import { TableCell, type TableCellProps } from '@mui/material';
import { useActionDisplay } from '../../contexts/ActionDisplayContext';
import { PortalActions, type PortalAction } from './PortalActions';
import { actionColumnSize } from './usePortalActionTableOptions';

/** Let the cell's content box account for theme, density, and explicit padding. */
export function PortalActionTableCell<T>({ row, actions, sx, ...props }: {
  row: T; actions: readonly PortalAction<T>[];
} & Omit<TableCellProps, 'children'>) {
  const { mode } = useActionDisplay();
  const width = actionColumnSize(mode);
  return <TableCell {...props} data-portal-action-cell sx={[{ width, maxWidth: width }, ...(Array.isArray(sx) ? sx : [sx])]}>
    <PortalActions row={row} actions={actions} />
  </TableCell>;
}
