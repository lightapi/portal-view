import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ACTION_DISPLAY_KEY, ActionDisplayProvider, useActionDisplay } from './ActionDisplayContext';

const wrapper = ({ children }: { children: React.ReactNode }) => <StrictMode><ActionDisplayProvider>{children}</ActionDisplayProvider></StrictMode>;
beforeEach(() => localStorage.clear());

it.each([null, 'true', 'garbage', 'menu'])('defaults safely for %s without writing on mount', value => {
  if (value !== null) localStorage.setItem(ACTION_DISPLAY_KEY, value);
  const { result } = renderHook(useActionDisplay, { wrapper });
  expect(result.current.mode).toBe('menu');
  expect(localStorage.getItem(ACTION_DISPLAY_KEY)).toBe(value);
});

it('shares the preference between consumers and restores it after remount', () => {
  const { result, unmount } = renderHook(() => [useActionDisplay(), useActionDisplay()], { wrapper });
  act(() => result.current[0].setMode('expanded'));
  expect(result.current[1].mode).toBe('expanded');
  expect(localStorage.getItem(ACTION_DISPLAY_KEY)).toBe('expanded');
  unmount();
  expect(renderHook(useActionDisplay, { wrapper }).result.current.mode).toBe('expanded');
});

it('synchronizes localStorage changes, removal, and clear across tabs, ignoring unrelated events', () => {
  const { result } = renderHook(useActionDisplay, { wrapper });
  const change = (key: string | null, newValue: string | null, storageArea: Storage | null = localStorage) =>
    act(() => window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea })));
  change(ACTION_DISPLAY_KEY, 'expanded');
  expect(result.current.mode).toBe('expanded');
  change('unrelated', 'menu');
  change(ACTION_DISPLAY_KEY, 'menu', sessionStorage);
  expect(result.current.mode).toBe('expanded');
  change(ACTION_DISPLAY_KEY, null);
  expect(result.current.mode).toBe('menu');
  change(ACTION_DISPLAY_KEY, 'expanded');
  change(null, null);
  expect(result.current.mode).toBe('menu');
  change(ACTION_DISPLAY_KEY, 'invalid');
  expect(result.current.mode).toBe('menu');
});

it('keeps the current session usable when storage reads and writes throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  const { result } = renderHook(useActionDisplay, { wrapper });
  expect(result.current.mode).toBe('menu');
  act(() => result.current.setMode('expanded'));
  expect(result.current.mode).toBe('expanded');
});

it('handles a throwing localStorage accessor', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
  const { result } = renderHook(useActionDisplay, { wrapper });
  act(() => result.current.setMode('expanded'));
  expect(result.current.mode).toBe('expanded');
});

it('fails clearly when the application provider is missing', () => {
  expect(() => renderHook(useActionDisplay)).toThrow('useActionDisplay must be inside an ActionDisplayProvider');
});
