import { act, render, renderHook, screen, within } from '@testing-library/react';
import { Table, TableBody, TableRow, ThemeProvider, createTheme } from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_TableOptions } from 'material-react-table';
import { expect, it, vi } from 'vitest';
import { ActionDisplayProvider, useActionDisplay } from '../../contexts/ActionDisplayContext';
import { PortalActionScope, PortalActions } from './PortalActions';
import { PortalActionTableCell } from './PortalActionTableCell';
import { actionColumnSize, usePortalActionTableOptions } from './usePortalActionTableOptions';

const wrapper = ({ children }: { children: React.ReactNode }) => <ActionDisplayProvider>{children}</ActionDisplayProvider>;
const actions = [{ id: 'edit', label: 'Edit', icon: <span />, onSelect: vi.fn() }];

it('uses stable widths independent of action count', () => {
  expect(actionColumnSize('menu')).toBe(120);
  expect(actionColumnSize('expanded')).toBe(80);
});

it('preserves table options and custom column metadata through a preference change', () => {
  localStorage.clear();
  const options: MRT_TableOptions<{ id: string }> = {
    columns: [{ accessorKey: 'id', header: 'ID' }, { id: 'actions', header: 'Operations', enableSorting: false }],
    data: [{ id: 'one' }], positionActionsColumn: 'last', enableRowSelection: true,
    state: { rowSelection: { one: true } }, onRowSelectionChange: vi.fn(),
    displayColumnDefOptions: { 'mrt-row-actions': { header: 'Do', enableHiding: false }, 'mrt-row-select': { size: 50 } },
  };
  const { result } = renderHook(() => ({
    table: usePortalActionTableOptions(options, ['actions', 'mrt-row-actions']), display: useActionDisplay(),
  }), { wrapper });
  expect(result.current.table.columns[1]).toMatchObject({ header: 'Operations', size: 120, enableSorting: false });
  act(() => result.current.display.setMode('expanded'));
  expect(result.current.table.columns[1]).toMatchObject({ size: 80, minSize: 80, maxSize: 80 });
  expect(result.current.table.columns[0]).toBe(options.columns[0]);
  expect(result.current.table.state).toBe(options.state);
  expect(result.current.table.data).toBe(options.data);
  expect(result.current.table.onRowSelectionChange).toBe(options.onRowSelectionChange);
  expect(result.current.table.positionActionsColumn).toBe('last');
  expect(result.current.table.displayColumnDefOptions).toMatchObject({
    'mrt-row-actions': { header: 'Do', enableHiding: false, size: 80 }, 'mrt-row-select': { size: 50 },
  });
});

it.each(['menu', 'expanded'] as const)('sizes a real MRT action column in %s mode', mode => {
  localStorage.setItem('portal.actionDisplay.v1', mode);
  function Example() {
    const table = useMaterialReactTable(usePortalActionTableOptions({
      columns: [{ accessorKey: 'id', header: 'ID' }], data: [{ id: 'one' }],
      enableRowActions: true, enableRowSelection: true, positionActionsColumn: 'last',
      renderRowActions: ({ row }) => <PortalActions row={row} actions={actions} />,
    }));
    return <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>;
  }
  render(<Example />, { wrapper });
  const header = screen.getByRole('columnheader', { name: /Actions/ });
  expect(header).toHaveStyle({ width: mode === 'menu' ? 'calc(var(--header-mrt_row_actions-size) * 1px)' : '1%' });
  expect(screen.getByRole('table').style.getPropertyValue('--header-mrt_row_actions-size')).toBe(String(actionColumnSize(mode)));
  expect(screen.getByRole('button', { name: mode === 'menu' ? 'Actions' : 'Edit' })).toBeVisible();
  expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
});

it.each(['normal', 'none'] as const)('native cells respect %s padding without subtracting a fixed width', padding => {
  localStorage.clear();
  const theme = createTheme({ components: { MuiTableCell: { styleOverrides: { root: { padding: 8 } } } } });
  render(<ThemeProvider theme={theme}><PortalActionScope><Table><TableBody><TableRow>
    <PortalActionTableCell row={null} actions={actions} padding={padding} />
  </TableRow></TableBody></Table></PortalActionScope></ThemeProvider>, { wrapper });
  const cell = screen.getByRole('cell');
  expect(cell).toHaveStyle({ width: '120px' });
  expect(within(cell).getByRole('button', { name: 'Actions' }).parentElement).toBe(cell);
  if (padding === 'none') expect(cell.className).toContain('MuiTableCell-paddingNone');
});

it('sizes every row to the widest visible icon group and shrinks when that row disappears', () => {
  localStorage.setItem('portal.actionDisplay.v1', 'expanded');
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const count = this.querySelectorAll('button').length;
    return { width: count * 40 + Math.max(0, count - 1) * 1.6, height: 40, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 40, toJSON: () => ({}) };
  });
  const definitions = Array.from({ length: 5 }, (_, index) => ({
    id: String(index), label: `Action ${index}`, icon: <span />, hidden: (count: number) => index >= count, onSelect: vi.fn(),
  }));
  const table = (counts: number[]) => <PortalActionScope><Table><TableBody>
    {counts.map((count, index) => <TableRow key={index}>
      <PortalActionTableCell row={count} actions={definitions} />
    </TableRow>)}
  </TableBody></Table></PortalActionScope>;
  const { rerender } = render(table([2, 5]), { wrapper });
  for (const cell of screen.getAllByRole('cell')) expect(cell).toHaveStyle({ width: '1%', minWidth: '239px' });
  rerender(table([2]));
  expect(screen.getByRole('cell')).toHaveStyle({ width: '1%', minWidth: '114px' });
});

it('keeps one resize observer across fresh action arrays and observes only the icon group', async () => {
  localStorage.setItem('portal.actionDisplay.v1', 'expanded');
  const observers: { notify: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  class Observer {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: () => void) { observers.push({ notify: callback, observe: this.observe, disconnect: this.disconnect }); }
  }
  vi.stubGlobal('ResizeObserver', Observer);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.querySelectorAll('button').length * 40;
    return { width, height: 40, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 40, toJSON: () => ({}) };
  });
  const table = (count: number, padding = 16) => <PortalActionScope><Table><TableBody><TableRow>
    <PortalActionTableCell row={null} sx={{ padding }} actions={Array.from({ length: count }, (_, index) => ({
      id: String(index), label: `Action ${index}`, icon: <span />, onSelect: vi.fn(),
    }))} style={{ padding }} />
  </TableRow></TableBody></Table></PortalActionScope>;
  try {
    const { rerender, unmount } = render(table(2), { wrapper });
    expect(observers).toHaveLength(1);
    const observer = observers[0];
    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(observer.observe.mock.calls[0][0].tagName).toBe('DIV');
    rerender(table(2));
    rerender(table(5));
    expect(observers).toHaveLength(1);
    expect(observer.disconnect).not.toHaveBeenCalled();
    act(() => observer.notify());
    expect(screen.getByRole('cell')).toHaveStyle({ minWidth: '232px' });
    rerender(table(5, 8));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('cell')).toHaveStyle({ minWidth: '216px' });
    expect(observers).toHaveLength(1);
    rerender(table(0));
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    rerender(table(2));
    expect(observers).toHaveLength(2);
    unmount();
    expect(observers[1].disconnect).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
});
