import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useUserState } from '../contexts/UserContext';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
type Pagination = { pageIndex: number; pageSize: number };

function initialPagination(key: string | null): Pagination {
  let pageSize = 25;
  try {
    const stored = key ? Number(localStorage.getItem(key)) : 0;
    if (PAGE_SIZE_OPTIONS.includes(stored)) pageSize = stored;
  } catch {
    // Storage can be disabled; pagination still works in memory.
  }
  return { pageIndex: 0, pageSize };
}

/** Persist only explicit size changes; each mounted table owns its current page. */
export function usePersistentPagination(): [Pagination, Dispatch<SetStateAction<Pagination>>] {
  const { userId } = useUserState();
  const key = userId ? `portal.tablePageSize.v1:${userId}` : null;
  const [state, setState] = useState(() => ({ key, pagination: initialPagination(key), changed: false }));
  // Reset during render so an account switch cannot issue a query with the old preference.
  if (state.key !== key) {
    setState({ key, pagination: initialPagination(key), changed: false });
  }
  const setPagination = useCallback<Dispatch<SetStateAction<Pagination>>>((update) => {
    setState(current => {
      const next = typeof update === 'function' ? update(current.pagination) : update;
      const pageSize = PAGE_SIZE_OPTIONS.includes(next.pageSize) ? next.pageSize : current.pagination.pageSize;
      const sizeChanged = pageSize !== current.pagination.pageSize;
      return {
        ...current,
        pagination: { pageIndex: sizeChanged ? 0 : next.pageIndex, pageSize },
        changed: current.changed || sizeChanged,
      };
    });
  }, []);
  useEffect(() => {
    if (!state.key || !state.changed) return;
    try {
      localStorage.setItem(state.key, String(state.pagination.pageSize));
    } catch {
      // A storage failure must not prevent changing pages.
    }
  }, [state.key, state.changed, state.pagination.pageSize]);
  return [state.pagination, setPagination];
}

/** Adapter for older MUI tables with separate page and rows-per-page handlers. */
export function usePersistentTablePagination() {
  const [pagination, setPagination] = usePersistentPagination();
  const setPage = (page: number) => setPagination(current => ({ ...current, pageIndex: page }));
  const setRowsPerPage = (size: number) => setPagination(current => ({ ...current, pageSize: size }));
  return { page: pagination.pageIndex, rowsPerPage: pagination.pageSize, setPage, setRowsPerPage };
}
