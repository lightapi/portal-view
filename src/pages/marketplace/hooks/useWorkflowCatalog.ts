import { useEffect, useMemo, useState } from 'react';
import fetchClient from '../../../utils/fetchClient';
import { buildPortalQueryUrl, formatTaxonomyLabel } from './useApiCatalog';

export { buildPortalQueryUrl };

export type WorkflowTagMatchMode = 'all' | 'any';
export type WorkflowCatalogStatus = 'active' | 'inactive';
export type WorkflowCatalogViewMode = 'grid' | 'list';
export type WorkflowCatalogSortField = 'name' | 'namespace' | 'version' | 'updateTs';
export type WorkflowCatalogSortOrder = 'asc' | 'desc';

export type WorkflowCatalogParams = {
  q: string;
  categories: string[];
  tags: string[];
  tagMatch: WorkflowTagMatchMode;
  status: WorkflowCatalogStatus;
  page: number;
  pageSize: number;
  sort: WorkflowCatalogSortField;
  order: WorkflowCatalogSortOrder;
  view: WorkflowCatalogViewMode;
};

export type WorkflowTaxonomyOption = {
  id: string;
  label: string;
  value: string;
};

export type WorkflowTagOption = WorkflowTaxonomyOption & {
  groupCode?: string | null;
  groupLabel?: string | null;
  groupSortOrder?: number | null;
  tagSortOrder?: number | null;
};

export type WorkflowTagGroup = {
  code: string;
  label: string;
  sortOrder: number;
  tags: WorkflowTagOption[];
};

export type WorkflowCatalogItem = {
  hostId: string;
  wfDefId: string;
  namespace: string;
  name: string;
  version: string;
  definition?: string;
  catalogVisible?: boolean;
  tagIds?: string[];
  tags?: string[];
  categoryIds?: string[];
  categories?: string[];
  ownerUserId?: string;
  ownerPositionId?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

type WorkflowCatalogResponse = {
  workflows?: WorkflowCatalogItem[];
  total?: number;
};

type UseWorkflowCatalogArgs = {
  host?: string | null;
  params: WorkflowCatalogParams;
};

const allowedPageSizes = new Set([12, 24, 48]);
const sortFields = new Set<WorkflowCatalogSortField>(['name', 'namespace', 'version', 'updateTs']);
const generalGroupSortOrder = Number.MAX_SAFE_INTEGER;

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseWorkflowCatalogParams(searchParams: URLSearchParams): WorkflowCatalogParams {
  const pageSize = positiveInt(searchParams.get('pageSize'), 12);
  const sort = searchParams.get('sort') as WorkflowCatalogSortField | null;
  const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid';

  return {
    q: searchParams.get('q') ?? '',
    categories: unique(searchParams.getAll('category')),
    tags: unique(searchParams.getAll('tag')),
    tagMatch: searchParams.get('tagMatch') === 'any' ? 'any' : 'all',
    status: searchParams.get('status') === 'inactive' ? 'inactive' : 'active',
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: allowedPageSizes.has(pageSize) ? pageSize : 12,
    sort: sort && sortFields.has(sort) ? sort : 'name',
    order,
    view,
  };
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function compareOptionalOrder(left?: number | null, right?: number | null) {
  const leftValue = left == null ? generalGroupSortOrder : left;
  const rightValue = right == null ? generalGroupSortOrder : right;
  return leftValue - rightValue;
}

function normalizeCategoryOptions(raw: unknown): WorkflowTaxonomyOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const source = item as Record<string, unknown>;
      const label = typeof source.label === 'string' ? source.label : '';
      const id = typeof source.id === 'string' ? source.id : label;
      return {
        id,
        label,
        value: label,
      };
    })
    .filter((option) => option.id && option.label)
    .sort((left, right) => left.label.localeCompare(right.label));
}

function normalizeTagOptions(raw: unknown): WorkflowTagOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const source = item as Record<string, unknown>;
      const label = typeof source.label === 'string' ? source.label : '';
      const id = typeof source.id === 'string' ? source.id : label;
      const value = typeof source.value === 'string' ? source.value : label;
      const groupLabel = typeof source.groupLabel === 'string' && source.groupLabel.trim()
        ? source.groupLabel
        : null;
      const groupCode = typeof source.groupCode === 'string' && source.groupCode.trim()
        ? source.groupCode
        : null;
      return {
        id,
        label,
        value,
        groupCode,
        groupLabel,
        groupSortOrder: toNumberOrNull(source.groupSortOrder),
        tagSortOrder: toNumberOrNull(source.tagSortOrder),
      };
    })
    .filter((option) => option.id && option.label)
    .sort((left, right) => {
      const groupCompare = compareOptionalOrder(left.groupSortOrder, right.groupSortOrder);
      if (groupCompare !== 0) return groupCompare;
      const tagCompare = compareOptionalOrder(left.tagSortOrder, right.tagSortOrder);
      if (tagCompare !== 0) return tagCompare;
      return left.label.localeCompare(right.label);
    });
}

function groupTags(tags: WorkflowTagOption[]): WorkflowTagGroup[] {
  const groups = new Map<string, WorkflowTagGroup>();
  for (const tag of tags) {
    const code = tag.groupCode || 'general';
    const label = tag.groupLabel || 'General';
    const sortOrder = tag.groupSortOrder ?? generalGroupSortOrder;
    const group = groups.get(code) ?? { code, label, sortOrder, tags: [] };
    group.tags.push(tag);
    groups.set(code, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      tags: [...group.tags].sort((left, right) => {
        const orderCompare = compareOptionalOrder(left.tagSortOrder, right.tagSortOrder);
        return orderCompare !== 0 ? orderCompare : left.label.localeCompare(right.label);
      }),
    }))
    .sort((left, right) => {
      const orderCompare = left.sortOrder - right.sortOrder;
      return orderCompare !== 0 ? orderCompare : left.label.localeCompare(right.label);
    });
}

export function formatWorkflowTaxonomyLabel(value: string) {
  return formatTaxonomyLabel(value);
}

export function useWorkflowCatalog({ host, params }: UseWorkflowCatalogArgs) {
  const [categories, setCategories] = useState<WorkflowTaxonomyOption[]>([]);
  const [tags, setTags] = useState<WorkflowTagOption[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowCatalogItem[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taxonomyFiltersActive = params.categories.length > 0 || params.tags.length > 0;
  const categoryFilterKey = params.categories.join('\u001f');
  const tagFilterKey = params.tags.join('\u001f');

  useEffect(() => {
    if (!host) return;

    let cancelled = false;
    setIsLoadingOptions(true);

    Promise.all([
      fetchClient(buildPortalQueryUrl('category', 'getCategoryLabelByType', { hostId: host, entityType: 'workflow' })),
      fetchClient(buildPortalQueryUrl('tag', 'getTagLabelByType', { hostId: host, entityType: 'workflow' })),
    ])
      .then(([categoryData, tagData]) => {
        if (cancelled) return;
        setCategories(normalizeCategoryOptions(categoryData));
        setTags(normalizeTagOptions(tagData));
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load workflow catalog taxonomy:', e);
        setError('Failed to load workflow catalog filters.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [host]);

  useEffect(() => {
    if (!host) return;

    let cancelled = false;
    setIsLoadingWorkflows(true);
    setError(null);

    const limit = params.pageSize;
    const offset = (params.page - 1) * params.pageSize;
    const sorting = JSON.stringify([{ id: params.sort, desc: params.order === 'desc' }]);

    const url = buildPortalQueryUrl('workflow', 'getWorkflowCatalog', {
      hostId: host,
      offset,
      limit,
      sorting,
      filters: JSON.stringify([]),
      globalFilter: params.q,
      active: params.status === 'active',
      categoryIds: params.categories,
      tagIds: params.tags,
      tagMatch: params.tagMatch,
    });

    fetchClient(url)
      .then((data: WorkflowCatalogResponse) => {
        if (cancelled) return;
        setWorkflows(data.workflows ?? []);
        setServerTotal(data.total ?? 0);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load workflow catalog:', e);
        setError('Failed to load workflow catalog.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingWorkflows(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    host,
    params.order,
    params.page,
    params.pageSize,
    params.q,
    params.sort,
    params.status,
    params.tagMatch,
    categoryFilterKey,
    tagFilterKey,
  ]);

  const tagGroups = useMemo(() => groupTags(tags), [tags]);

  return {
    categories,
    tags,
    tagGroups,
    workflows,
    summaries: {},
    total: serverTotal,
    isLoadingOptions,
    isLoadingWorkflows,
    isLoadingSummaries: false,
    error,
    taxonomyFiltersActive,
  };
}
