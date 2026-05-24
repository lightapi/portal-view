import type { MRT_ColumnFiltersState } from 'material-react-table';

export type OAuthSessionViewMode = 'admin' | 'self';

export type OAuthSessionPageProps = {
  viewMode?: OAuthSessionViewMode;
};

export function isSelfSessionView(viewMode?: OAuthSessionViewMode) {
  return viewMode === 'self';
}

export function lockedCurrentUserFilter(userId?: string | null) {
  return userId ? { id: 'userId', value: userId } : null;
}

export function withLockedFilter(
  filters: MRT_ColumnFiltersState,
  lockedFilter: { id: string; value: unknown } | null,
): MRT_ColumnFiltersState {
  if (!lockedFilter) return [...filters];
  return [
    ...filters.filter((filter) => filter.id !== lockedFilter.id),
    lockedFilter,
  ];
}

export function userScopedRouteState<T extends { userId?: string }>(data: T, selfView: boolean) {
  if (!selfView) return data;
  const { userId, ...rest } = data;
  return rest;
}
