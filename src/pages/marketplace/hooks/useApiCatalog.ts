import { useEffect, useMemo, useState } from 'react';
import fetchClient from '../../../utils/fetchClient';

export type TagMatchMode = 'all' | 'any';
export type CatalogStatus = 'active' | 'inactive';
export type CatalogViewMode = 'grid' | 'list';
export type CatalogSortField = 'apiName' | 'apiId' | 'apiStatus' | 'updateTs';
export type CatalogSortOrder = 'asc' | 'desc';

export type ApiCatalogParams = {
  q: string;
  categories: string[];
  tags: string[];
  tagMatch: TagMatchMode;
  status: CatalogStatus;
  page: number;
  pageSize: number;
  sort: CatalogSortField;
  order: CatalogSortOrder;
  view: CatalogViewMode;
};

export type TaxonomyOption = {
  id: string;
  label: string;
  value: string;
};

export type TagOption = TaxonomyOption & {
  groupCode?: string | null;
  groupLabel?: string | null;
  groupSortOrder?: number | null;
  tagSortOrder?: number | null;
};

export type TagGroup = {
  code: string;
  label: string;
  sortOrder: number;
  tags: TagOption[];
};

export type ApiCatalogItem = {
  hostId: string;
  apiId: string;
  apiName?: string;
  apiDesc?: string;
  operationOwner?: string;
  deliveryOwner?: string;
  region?: string;
  businessGroup?: string;
  lob?: string;
  platform?: string;
  capability?: string;
  gitRepo?: string;
  tagIds?: string[];
  tags?: string[];
  categoryIds?: string[];
  categories?: string[];
  apiStatus?: string;
  ownerUserId?: string;
  ownerPositionId?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

type ApiCatalogResponse = {
  services?: ApiCatalogItem[];
  total?: number;
};

type UseApiCatalogArgs = {
  host?: string | null;
  params: ApiCatalogParams;
};

const allowedPageSizes = new Set([12, 24, 48]);
const generalGroupSortOrder = Number.MAX_SAFE_INTEGER;

const sortFields = new Set<CatalogSortField>(['apiName', 'apiId', 'apiStatus', 'updateTs']);

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseApiCatalogParams(searchParams: URLSearchParams): ApiCatalogParams {
  const pageSize = positiveInt(searchParams.get('pageSize'), 12);
  const sort = searchParams.get('sort') as CatalogSortField | null;
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
    sort: sort && sortFields.has(sort) ? sort : 'apiName',
    order,
    view,
  };
}

export function buildPortalQueryUrl(service: string, action: string, data: Record<string, unknown>) {
  const cmd = {
    host: 'lightapi.net',
    service,
    action,
    version: '0.1.0',
    data,
  };
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
}

export function formatTaxonomyLabel(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function normalizeCategoryOptions(raw: unknown): TaxonomyOption[] {
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

function normalizeTagOptions(raw: unknown): TagOption[] {
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

function groupTags(tags: TagOption[]): TagGroup[] {
  const groups = new Map<string, TagGroup>();
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

export function useApiCatalog({ host, params }: UseApiCatalogArgs) {
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [apis, setApis] = useState<ApiCatalogItem[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingApis, setIsLoadingApis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taxonomyFiltersActive = params.categories.length > 0 || params.tags.length > 0;
  const categoryFilterKey = params.categories.join('\u001f');
  const tagFilterKey = params.tags.join('\u001f');

  useEffect(() => {
    if (!host) return;

    let cancelled = false;
    setIsLoadingOptions(true);

    Promise.all([
      fetchClient(buildPortalQueryUrl('category', 'getCategoryLabelByType', { hostId: host, entityType: 'api' })),
      fetchClient(buildPortalQueryUrl('tag', 'getTagLabelByType', { hostId: host, entityType: 'api' })),
    ])
      .then(([categoryData, tagData]) => {
        if (cancelled) return;
        setCategories(normalizeCategoryOptions(categoryData));
        setTags(normalizeTagOptions(tagData));
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load API catalog taxonomy:', e);
        setError('Failed to load API catalog filters.');
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
    setIsLoadingApis(true);
    setError(null);

    const limit = params.pageSize;
    const offset = (params.page - 1) * params.pageSize;
    const sorting = JSON.stringify([{ id: params.sort, desc: params.order === 'desc' }]);

    const url = buildPortalQueryUrl('service', 'getApi', {
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
      .then((data: ApiCatalogResponse) => {
        if (cancelled) return;
        setApis(data.services ?? []);
        setServerTotal(data.total ?? 0);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load API catalog:', e);
        setError('Failed to load API catalog.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApis(false);
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

  const total = serverTotal;
  const tagGroups = useMemo(() => groupTags(tags), [tags]);

  return {
    categories,
    tags,
    tagGroups,
    apis,
    total,
    isLoadingOptions,
    isLoadingApis,
    error,
    taxonomyFiltersActive,
  };
}
