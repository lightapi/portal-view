export type OwnershipFilter = {
  id: string;
  value: unknown;
};

export type OwnershipScopeOptions = {
  roles?: string | null;
  userId?: string | null;
  ownerField: string;
  allScopeRoles?: string[];
  allScopeAllowed?: boolean;
};

export type OwnershipScope = {
  ownerField: string;
  ownedOnly: boolean;
  canReadAll: boolean;
  canWriteAll: boolean;
  hasOwnerContext: boolean;
  ownerFilter: OwnershipFilter | null;
  ownsRecord: <TRecord extends object>(record: TRecord) => boolean;
  canModifyRecord: <TRecord extends object>(record: TRecord) => boolean;
};

// Global all-record visibility. Entity-specific roles can be added per page.
export const defaultAllScopeRoles = ['admin'];

function roleTokens(roles: string | null | undefined) {
  return new Set((roles ?? '').split(/[\s,]+/).filter(Boolean));
}

export function hasAnyRole(roles: string | null | undefined, requiredRoles: string[]) {
  const userRoles = roleTokens(roles);
  return requiredRoles.some((role) => userRoles.has(role));
}

export function ownershipScope({
  roles,
  userId,
  ownerField,
  allScopeRoles = defaultAllScopeRoles,
  allScopeAllowed = true,
}: OwnershipScopeOptions): OwnershipScope {
  const normalizedUserId = userId?.trim() || null;
  const canReadAll = allScopeAllowed && hasAnyRole(roles, allScopeRoles);
  const canWriteAll = canReadAll;
  const ownedOnly = !canReadAll;
  const ownerFilter = ownedOnly && normalizedUserId ? { id: ownerField, value: normalizedUserId } : null;

  const ownsRecord = <TRecord extends object>(record: TRecord) => {
    if (!normalizedUserId) return false;

    const ownerValue = (record as Record<string, unknown>)[ownerField];
    return ownerValue != null && String(ownerValue) === normalizedUserId;
  };

  return {
    ownerField,
    ownedOnly,
    canReadAll,
    canWriteAll,
    hasOwnerContext: !ownedOnly || !!normalizedUserId,
    ownerFilter,
    ownsRecord,
    canModifyRecord: (record) => canWriteAll || ownsRecord(record),
  };
}

export function applyOwnershipFilter<TFilter extends OwnershipFilter>(
  filters: readonly TFilter[],
  ownership: Pick<OwnershipScope, 'ownedOnly' | 'ownerField' | 'ownerFilter'>,
) {
  const scopedFilters: OwnershipFilter[] = ownership.ownedOnly
    ? filters.filter((filter) => filter.id !== ownership.ownerField)
    : [...filters];

  if (ownership.ownerFilter) {
    scopedFilters.push(ownership.ownerFilter);
  }

  return scopedFilters;
}
