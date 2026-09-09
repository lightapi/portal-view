import { useMemo } from 'react';
import type { MRT_ColumnDef, MRT_RowData, MRT_TableOptions } from 'material-react-table';
import { useActionDisplay } from '../../contexts/ActionDisplayContext';

/** Minimum width before the scope measures the rendered icon rows. */
export function actionColumnSize(mode: 'menu' | 'expanded') {
  return mode === 'menu' ? 120 : 80;
}


/** Mark both cells so a scope can apply the widest rendered row to the whole column. */
export function portalActionColumn<T extends MRT_RowData>(column: MRT_ColumnDef<T>, mode: 'menu' | 'expanded'): MRT_ColumnDef<T> {
  const size = actionColumnSize(mode);
  return { ...column, size, minSize: size, maxSize: size, grow: false,
    muiTableHeadCellProps: args => ({
      ...(typeof column.muiTableHeadCellProps === 'function' ? column.muiTableHeadCellProps(args) : column.muiTableHeadCellProps),
      'data-portal-action-cell': true,
      'data-portal-action-grid': args.table.options.layoutMode !== 'semantic',
    }),
    muiTableBodyCellProps: args => ({
      ...(typeof column.muiTableBodyCellProps === 'function' ? column.muiTableBodyCellProps(args) : column.muiTableBodyCellProps),
      'data-portal-action-cell': true,
      'data-portal-action-grid': args.table.options.layoutMode !== 'semantic',
    }),
  };
}

/** Preserve every table option, including action position and controlled selection. */
export function usePortalActionTableOptions<T extends MRT_RowData>(
  options: MRT_TableOptions<T>, actionColumnIds: readonly string[] = ['mrt-row-actions'],
): MRT_TableOptions<T> {
  const { mode } = useActionDisplay();
  const idsKey = JSON.stringify(actionColumnIds);
  const columns = useMemo(() => {
    const ids = new Set<string>(JSON.parse(idsKey));
    const resize = (column: MRT_ColumnDef<T>): MRT_ColumnDef<T> => {
      if (!ids.has(column.id ?? String(column.accessorKey ?? ''))) return column;
      return portalActionColumn(column, mode);
    };
    return options.columns.map(resize);
  }, [options.columns, idsKey, mode]);
  return {
    ...options, columns,
    displayColumnDefOptions: {
      ...options.displayColumnDefOptions,
      ...(actionColumnIds.includes('mrt-row-actions') ? { 'mrt-row-actions': portalActionColumn({ header: 'Actions', ...options.displayColumnDefOptions?.['mrt-row-actions'] }, mode) } : {}),
    },
  };
}
