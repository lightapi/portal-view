import { useState } from 'react';
import { Button, Dialog, DialogTitle, TextField } from '@mui/material';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ACTION_DISPLAY_KEY, ActionDisplayProvider } from '../../contexts/ActionDisplayContext';
import { ActionDisplayToggle } from './ActionDisplayToggle';
import { PortalActions, PortalActionScope, type PortalAction } from './PortalActions';

const row = { id: 'agent', canPublish: true };
const selected = vi.fn();
const actions: PortalAction<typeof row>[] = [
  { id: 'delete', label: 'Delete', icon: <span />, destructive: true, onSelect: selected },
  { id: 'edit', label: 'Edit', description: 'Change instance settings.', icon: <span />, onSelect: selected },
  { id: 'publish', label: 'Publish', icon: <span />, disabledReason: value => value.canPublish ? null : 'Requires a current instance.', onSelect: selected },
  { id: 'hidden', label: 'Hidden', icon: <span />, hidden: () => true, onSelect: selected },
  { id: 'busy', label: 'Working', icon: <span />, loading: () => true, onSelect: selected },
];
beforeEach(() => { localStorage.clear(); selected.mockClear(); });
const app = (children: React.ReactNode) => <ActionDisplayProvider><ActionDisplayToggle /><PortalActionScope>{children}</PortalActionScope></ActionDisplayProvider>;

it('shows labels and reasons, omits hidden actions, and sorts destructive actions last', async () => {
  render(app(<PortalActions row={{ ...row, canPublish: false }} actions={actions} />));
  await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
  expect(screen.getAllByRole('menuitem').map(item => item.getAttribute('aria-label'))).toEqual(['Edit', 'Publish', 'Working', 'Delete']);
  expect(screen.getByText('Requires a current instance.')).toBeVisible();
  expect(screen.getByText('Change instance settings.')).toBeVisible();
  expect(screen.getByRole('menuitem', { name: 'Publish' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  await waitFor(() => expect(selected).toHaveBeenCalledWith({ ...row, canPublish: false }));
});

it('updates the open menu when permissions change and does not invoke a newly disabled action', async () => {
  const { rerender } = render(app(<PortalActions row={row} actions={actions} />));
  await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
  rerender(app(<PortalActions row={{ ...row, canPublish: false }} actions={actions} />));
  expect(await screen.findByText('Requires a current instance.')).toBeVisible();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Publish' }));
  expect(selected).not.toHaveBeenCalled();
});

it('switches all rows to expanded buttons and closes an open menu without row selection', async () => {
  const rowClick = vi.fn();
  render(app(<div onClick={rowClick}><PortalActions row={row} actions={actions} /><PortalActions row={row} actions={actions} /></div>));
  await userEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]);
  expect(rowClick).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: ACTION_DISPLAY_KEY, newValue: 'expanded' })));
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
  await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
  expect(rowClick).not.toHaveBeenCalled();
  expect(selected).toHaveBeenCalledTimes(1);
});

it('supports keyboard opening, navigation and Escape with focus returned to the trigger', async () => {
  render(app(<PortalActions row={row} actions={actions} />));
  const trigger = screen.getByRole('button', { name: 'Actions' });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Publish' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(trigger).toHaveFocus());
});

it('finishes closing the menu before opening a dialog and retains dialog focus', async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return <><PortalActionScope><PortalActions row={row} actions={[
      { id: 'publish', label: 'Publish policy', icon: <span />, onSelect: () => setOpen(true) },
    ]} /></PortalActionScope><Dialog open={open} onClose={() => setOpen(false)}>
      <DialogTitle>Publish policy</DialogTitle><TextField autoFocus label="Policy" /><Button onClick={() => setOpen(false)}>Cancel</Button>
    </Dialog></>;
  }
  render(<ActionDisplayProvider><Example /></ActionDisplayProvider>);
  await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Publish policy' }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialog).getByRole('textbox')).toHaveFocus());
});

it('uses one menu for 100 rows and targets the selected row', async () => {
  render(app(Array.from({ length: 100 }, (_, index) => <PortalActions key={index} row={{ ...row, id: String(index) }} actions={actions} />)));
  expect(screen.getAllByRole('button', { name: 'Actions' })).toHaveLength(100);
  await userEvent.click(screen.getAllByRole('button', { name: 'Actions' })[99]);
  expect(screen.getAllByRole('menu')).toHaveLength(1);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  await waitFor(() => expect(selected).toHaveBeenCalledWith({ ...row, id: '99' }));
});

it('keeps expanded toolbar actions content-sized beside the primary action', () => {
  localStorage.setItem(ACTION_DISPLAY_KEY, 'expanded');
  render(app(<div style={{ display: 'flex' }}>
    <Button>Create</Button><PortalActions row={row} actions={actions} />
  </div>));
  const group = screen.getByRole('button', { name: 'Edit' }).parentElement?.parentElement;
  expect(group).toHaveStyle({ width: 'max-content', flexWrap: 'nowrap' });
  expect(screen.getByRole('button', { name: 'Edit' })).toHaveTextContent('');
  expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass('MuiIconButton-root');
  expect(screen.getByRole('button', { name: 'Create' })).toBeVisible();
});
