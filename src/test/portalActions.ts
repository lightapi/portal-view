import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Exercise the default menu instead of relying on icons that are no longer always visible. */
export async function openPortalActions(container?: HTMLElement) {
  const queries = container ? within(container) : screen;
  await userEvent.click(await queries.findByRole('button', { name: 'Actions' }));
}

export async function selectPortalAction(name: string, container?: HTMLElement) {
  await openPortalActions(container);
  await userEvent.click(await screen.findByRole('menuitem', { name }));
  await waitFor(() => {
    if (screen.queryByRole('menu')) throw new Error('Action menu is still closing');
  });
}
