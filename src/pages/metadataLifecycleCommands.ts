type LifecycleRow = {
  hostId?: string | null;
  globalFlag?: boolean;
  aggregateVersion: number;
};

export function withLifecycleScope<T extends LifecycleRow>(row: T) {
  const { hostId, globalFlag, ...intent } = row;
  return {
    ...intent,
    ...(hostId ? { hostId } : {}),
    globalFlag: globalFlag ?? !hostId,
  };
}

export function categoryRestoreCommand(row: LifecycleRow & { categoryId: string }) {
  return {
    host: 'lightapi.net', service: 'category', action: 'restoreCategory', version: '0.1.0',
    data: withLifecycleScope({
      hostId: row.hostId, globalFlag: row.globalFlag,
      categoryId: row.categoryId,
      aggregateVersion: row.aggregateVersion,
    }),
  };
}

export function categoryDeleteCommand(row: LifecycleRow & { categoryId: string }) {
  return {
    host: 'lightapi.net', service: 'category', action: 'deleteCategory', version: '0.1.0',
    data: withLifecycleScope({
      hostId: row.hostId, globalFlag: row.globalFlag,
      categoryId: row.categoryId,
      aggregateVersion: row.aggregateVersion,
    }),
  };
}

export function tagRestoreCommand(row: LifecycleRow & { tagId: string }) {
  return {
    host: 'lightapi.net', service: 'tag', action: 'restoreTag', version: '0.1.0',
    data: withLifecycleScope({
      hostId: row.hostId, globalFlag: row.globalFlag,
      tagId: row.tagId,
      aggregateVersion: row.aggregateVersion,
    }),
  };
}

export function tagDeleteCommand(row: LifecycleRow & { tagId: string }) {
  return {
    host: 'lightapi.net', service: 'tag', action: 'deleteTag', version: '0.1.0',
    data: withLifecycleScope({
      hostId: row.hostId, globalFlag: row.globalFlag,
      tagId: row.tagId,
      aggregateVersion: row.aggregateVersion,
    }),
  };
}
