import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileMenu from './ProfileMenu';
import { signIn } from '../../utils/signIn';

vi.mock('../../../config', () => ({ isSsoEnabled: () => false }));
vi.mock('../../utils/signIn', () => ({ signIn: vi.fn() }));
vi.mock('../../contexts/UserContext', () => ({
  changePassword: vi.fn(), getOrders: vi.fn(), getPayment: vi.fn(), getProfile: vi.fn(),
  userHost: vi.fn(), createOrg: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), updateRoles: vi.fn(),
  useUserDispatch: () => vi.fn(), useUserState: () => ({ isAuthenticated: false, roles: [] }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../PortalActions/ActionDisplayToggle', () => ({ ActionDisplayToggle: () => null }));

describe('ProfileMenu sign-in security', () => {
  it('delegates sign-in to the shared OAuth helper instead of generating its own state', () => {
    render(<ProfileMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign In' }));
    expect(signIn).toHaveBeenCalledOnce();
  });
});
