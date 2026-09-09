import { StrictMode, useEffect } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { usePersistentPagination } from './usePersistentPagination';

const user = vi.hoisted(() => ({ userId: 'alice' as string | null }));
vi.mock('../contexts/UserContext', () => ({ useUserState: () => user }));
const key = (id: string) => `portal.tablePageSize.v1:${id}`;
beforeEach(() => { localStorage.clear(); user.userId = 'alice'; });

it('defaults to 25 without writing a preference on mount or page navigation', () => {
  const { result } = renderHook(usePersistentPagination);
  expect(result.current[0]).toEqual({ pageIndex: 0, pageSize: 25 });
  act(() => result.current[1](p => ({ ...p, pageIndex: 3 })));
  expect(result.current[0].pageIndex).toBe(3);
  expect(localStorage.getItem(key('alice'))).toBeNull();
});

it('persists size changes, resets the page atomically, and restores on another table', () => {
  const { result, unmount } = renderHook(usePersistentPagination, { wrapper: StrictMode });
  act(() => result.current[1]({ pageIndex: 4, pageSize: 25 }));
  act(() => result.current[1](p => ({ ...p, pageSize: 100 })));
  expect(result.current[0]).toEqual({ pageIndex: 0, pageSize: 100 });
  expect(localStorage.getItem(key('alice'))).toBe('100');
  unmount();
  expect(renderHook(usePersistentPagination).result.current[0]).toEqual({ pageIndex: 0, pageSize: 100 });
});

it('uses the saved size for the first query and account changes', () => {
  localStorage.setItem(key('alice'), '100');
  localStorage.setItem(key('bob'), '50');
  const query = vi.fn();
  const { rerender } = renderHook(() => {
    const [pagination] = usePersistentPagination();
    useEffect(() => { query({ offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize }); }, [pagination]);
  });
  expect(query.mock.calls).toEqual([[{ offset: 0, limit: 100 }]]);
  user.userId = 'bob'; rerender();
  expect(query.mock.calls).toEqual([[{ offset: 0, limit: 100 }], [{ offset: 0, limit: 50 }]]);
  expect(localStorage.getItem(key('alice'))).toBe('100');
});

it.each(['garbage', '0', '-1', '1000', '25.5'])('rejects invalid stored size %s', value => {
  localStorage.setItem(key('alice'), value);
  expect(renderHook(usePersistentPagination).result.current[0].pageSize).toBe(25);
});

it('keeps pagination working when storage reads and writes throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  const { result } = renderHook(usePersistentPagination);
  act(() => result.current[1]({ pageIndex: 2, pageSize: 50 }));
  expect(result.current[0]).toEqual({ pageIndex: 0, pageSize: 50 });
});

it('does not persist anonymous selections or leak them into a signed-in account', () => {
  user.userId = null;
  const { result, rerender } = renderHook(usePersistentPagination);
  act(() => result.current[1]({ pageIndex: 0, pageSize: 100 }));
  expect(localStorage.length).toBe(0);
  user.userId = 'alice'; rerender();
  expect(result.current[0].pageSize).toBe(25);
});
