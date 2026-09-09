import { MenuItem, MenuList } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { ACTION_DISPLAY_KEY, ActionDisplayProvider } from '../../contexts/ActionDisplayContext';
import { ActionDisplayToggle } from './ActionDisplayToggle';

it('participates in menu arrow navigation and toggles with Enter and Space', async () => {
  localStorage.clear();
  render(<ActionDisplayProvider><MenuList autoFocusItem>
    <MenuItem>Profile</MenuItem><ActionDisplayToggle /><MenuItem>Sign out</MenuItem>
  </MenuList></ActionDisplayProvider>);
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  const toggle = screen.getByRole('menuitemcheckbox', { name: 'Expanded buttons' });
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  await userEvent.keyboard('{Enter}');
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(localStorage.getItem(ACTION_DISPLAY_KEY)).toBe('expanded');
  await userEvent.keyboard(' ');
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  await userEvent.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
});
