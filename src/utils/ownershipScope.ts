export type OwnershipFilter = {
  id: string;
  value: unknown;
};

export type OwnershipScopeOptions = {
  roles?: string | null;
  userId?: string | null;
  positions?: string | null;
  ownerField?: string;
  ownerUserField?: string;
  ownerPositionField?: string;
  allScopeRoles?: string[];
  allScopeAllowed?: boolean;
};

export type OwnershipScope = {
  ownerField: string;
  ownerUserField: string;
  ownerPositionField?: string;
  ownedOnly: boolean;
  canReadAll: boolean;
  canWriteAll: boolean;
  hasOwnerContext: boolean;
  ownerFilter: OwnershipFilter | null;
  ownsRecord: <TRecord extends object>(record: TRecord) => boolean;
  canModifyRecord: <TRecord extends object>(record: TRecord) => boolean;
};

// Global all-record visibility.
export const defaultAllScopeRoles = ['admin', 'host-admin'];

function roleTokens(roles: string | null | undefined) {
  return new Set((roles ?? '').split(/[\s,]+/).filter(Boolean));
}

function valueTokens(values: string | null | undefined) {
  return new Set((values ?? '').split(/[\s,]+/).filter(Boolean));
}

export function hasAnyRole(roles: string | null | undefined, requiredRoles: string[]) {
  const userRoles = roleTokens(roles);
  return requiredRoles.some((role) => userRoles.has(role));
}

export function ownershipScope({
  roles,
  userId,
  positions,
  ownerField,
  ownerUserField,
  ownerPositionField,
  allScopeRoles = defaultAllScopeRoles,
  allScopeAllowed = true,
}: OwnershipScopeOptions): OwnershipScope {
  const normalizedUserId = userId?.trim() || null;
  const normalizedOwnerUserField = ownerUserField ?? ownerField ?? 'ownerUserId';
  const normalizedOwnerPositionField = ownerPositionField ?? 'ownerPositionId';
  const userPositions = valueTokens(positions);
  const canReadAll = allScopeAllowed && hasAnyRole(roles, allScopeRoles);
  const canWriteAll = canReadAll;
  const ownedOnly = !canReadAll;
  const ownerFilter = ownedOnly && normalizedUserId ? { id: normalizedOwnerUserField, value: normalizedUserId } : null;

  const ownsRecord = <TRecord extends object>(record: TRecord) => {
    if (!normalizedUserId && userPositions.size === 0) return false;

    const recordMap = record as Record<string, unknown>;
    const ownerUserValue = recordMap[normalizedOwnerUserField];
    const legacyOwnerValue = ownerField && ownerField !== normalizedOwnerUserField ? recordMap[ownerField] : null;
    const ownerPositionValue = recordMap[normalizedOwnerPositionField];

    return (ownerUserValue != null && String(ownerUserValue) === normalizedUserId)
      || (legacyOwnerValue != null && String(legacyOwnerValue) === normalizedUserId)
      || (ownerPositionValue != null && userPositions.has(String(ownerPositionValue)));
  };

  return {
    ownerField: normalizedOwnerUserField,
    ownerUserField: normalizedOwnerUserField,
    ownerPositionField: normalizedOwnerPositionField,
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
  ownership: Pick<OwnershipScope, 'ownedOnly' | 'ownerField' | 'ownerUserField' | 'ownerPositionField' | 'ownerFilter'>,
) {
  const scopedFilters: OwnershipFilter[] = ownership.ownedOnly
    ? filters.filter((filter) => filter.id !== ownership.ownerField
      && filter.id !== ownership.ownerUserField
      && filter.id !== ownership.ownerPositionField)
    : [...filters];

  return scopedFilters;
}

export function applyOwnershipColumns<TColumn extends { accessorKey?: string }>(
  columns: readonly TColumn[],
  ownership: Pick<OwnershipScope, 'ownedOnly' | 'ownerField' | 'ownerUserField' | 'ownerPositionField'>,
) {
  return ownership.ownedOnly
    ? columns.filter((column) => column.accessorKey !== ownership.ownerField
      && column.accessorKey !== ownership.ownerUserField
      && column.accessorKey !== ownership.ownerPositionField)
    : [...columns];
}
