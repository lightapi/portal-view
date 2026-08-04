import { useEffect, useMemo, useState } from 'react';
import fetchClient from '../../../utils/fetchClient';
import { queryLlm } from '../../genai/llm-model/api';
import { buildPortalQueryUrl } from './useApiCatalog';

export type LlmModelTagMatchMode = 'all' | 'any';
export type LlmModelCatalogStatus = 'active' | 'inactive';
export type LlmModelCatalogViewMode = 'grid' | 'list';
export type LlmModelCatalogSortField = 'physicalModelId' | 'providerType' | 'modelFamily' | 'lifecycleStatus' | 'updateTs';
export type LlmModelCatalogSortOrder = 'asc' | 'desc';

export type LlmModelCatalogParams = {
  q: string;
  categories: string[];
  tags: string[];
  tagMatch: LlmModelTagMatchMode;
  status: LlmModelCatalogStatus;
  page: number;
  pageSize: number;
  sort: LlmModelCatalogSortField;
  order: LlmModelCatalogSortOrder;
  view: LlmModelCatalogViewMode;
};

export type LlmTaxonomyOption = {
  id: string;
  label: string;
  value: string;
  groupCode?: string | null;
  groupLabel?: string | null;
  groupSortOrder?: number | null;
  tagSortOrder?: number | null;
};

export type LlmTagGroup = {
  code: string;
  label: string;
  sortOrder: number;
  tags: LlmTaxonomyOption[];
};

export type LlmModelCatalogItem = {
  hostId: string;
  modelId: string;
  providerType: string;
  physicalModelId: string;
  modelFamily: string;
  modelVersion?: string;
  lifecycleStatus?: string;
  contextTokenLimit?: number;
  outputTokenLimit?: number;
  modalities?: string[];
  operations?: string[];
  declaredCapabilities?: Record<string, unknown>;
  categoryIds?: string[];
  tagIds?: string[];
  categories?: string[];
  tags?: string[];
  aggregateVersion?: number;
  active?: boolean;
  updateTs?: string;
};

const allowedPageSizes = new Set([12, 24, 48]);
const sortFields = new Set<LlmModelCatalogSortField>([
  'physicalModelId', 'providerType', 'modelFamily', 'lifecycleStatus', 'updateTs',
]);
const generalGroupSortOrder = Number.MAX_SAFE_INTEGER;

function unique(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseLlmModelCatalogParams(searchParams: URLSearchParams): LlmModelCatalogParams {
  const pageSize = positiveInt(searchParams.get('pageSize'), 12);
  const sort = searchParams.get('sort') as LlmModelCatalogSortField | null;
  return {
    q: searchParams.get('q') ?? '',
    categories: unique(searchParams.getAll('category')),
    tags: unique(searchParams.getAll('tag')),
    tagMatch: searchParams.get('tagMatch') === 'any' ? 'any' : 'all',
    status: searchParams.get('status') === 'inactive' ? 'inactive' : 'active',
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: allowedPageSizes.has(pageSize) ? pageSize : 12,
    sort: sort && sortFields.has(sort) ? sort : 'physicalModelId',
    order: searchParams.get('order') === 'desc' ? 'desc' : 'asc',
    view: searchParams.get('view') === 'list' ? 'list' : 'grid',
  };
}

function numberOrNull(value: unknown) {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTaxonomy(raw: unknown, grouped = false): LlmTaxonomyOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    const source = item as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id : '';
    const label = typeof source.label === 'string' ? source.label : id;
    return {
      id,
      label,
      value: id,
      groupCode: grouped && typeof source.groupCode === 'string' ? source.groupCode : null,
      groupLabel: grouped && typeof source.groupLabel === 'string' ? source.groupLabel : null,
      groupSortOrder: numberOrNull(source.groupSortOrder),
      tagSortOrder: numberOrNull(source.tagSortOrder),
    };
  }).filter(option => option.id && option.label);
}

function groupTags(tags: LlmTaxonomyOption[]): LlmTagGroup[] {
  const groups = new Map<string, LlmTagGroup>();
  for (const tag of tags) {
    const code = tag.groupCode || 'general';
    const group = groups.get(code) ?? {
      code,
      label: tag.groupLabel || 'General',
      sortOrder: tag.groupSortOrder ?? generalGroupSortOrder,
      tags: [],
    };
    group.tags.push(tag);
    groups.set(code, group);
  }
  return Array.from(groups.values())
    .map(group => ({...group, tags: group.tags.sort((a, b) =>
      (a.tagSortOrder ?? generalGroupSortOrder) - (b.tagSortOrder ?? generalGroupSortOrder)
      || a.label.localeCompare(b.label))}))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function containsEvery(source: string[] | undefined, selected: string[]) {
  return selected.every(value => source?.includes(value));
}

function containsAny(source: string[] | undefined, selected: string[]) {
  return selected.length === 0 || selected.some(value => source?.includes(value));
}

function searchable(model: LlmModelCatalogItem) {
  return [
    model.physicalModelId, model.providerType, model.modelFamily, model.modelVersion,
    model.lifecycleStatus, ...(model.modalities ?? []), ...(model.operations ?? []),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

const GLOBAL_TAXONOMY_HOST = '00000000-0000-0000-0000-000000000000';

async function loadAllModels(active: boolean) {
  const pageSize = 200;
  const result: LlmModelCatalogItem[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const value = await queryLlm('getLlmModel', {offset, limit: pageSize, active});
    const page = Array.isArray(value) ? value as LlmModelCatalogItem[] : [];
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

export function useLlmModelCatalog({params}: {params: LlmModelCatalogParams}) {
  const [categories, setCategories] = useState<LlmTaxonomyOption[]>([]);
  const [tags, setTags] = useState<LlmTaxonomyOption[]>([]);
  const [allModels, setAllModels] = useState<LlmModelCatalogItem[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingOptions(true);
    Promise.all([
      fetchClient(buildPortalQueryUrl('category', 'getCategoryLabelByType', {hostId: GLOBAL_TAXONOMY_HOST, entityType: 'llm_model'})),
      fetchClient(buildPortalQueryUrl('tag', 'getTagLabelByType', {hostId: GLOBAL_TAXONOMY_HOST, entityType: 'llm_model'})),
    ]).then(([categoryData, tagData]) => {
      if (cancelled) return;
      setCategories(normalizeTaxonomy(categoryData).sort((a, b) => a.label.localeCompare(b.label)));
      setTags(normalizeTaxonomy(tagData, true));
    }).catch(reason => {
      if (cancelled) return;
      console.error('Failed to load LLM model taxonomy:', reason);
      setError('Failed to load LLM model catalog filters.');
    }).finally(() => {
      if (!cancelled) setIsLoadingOptions(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingModels(true);
    setError(null);
    loadAllModels(params.status === 'active').then(models => {
      if (!cancelled) setAllModels(models);
    }).catch(reason => {
      if (cancelled) return;
      console.error('Failed to load LLM model catalog:', reason);
      setError('Failed to load LLM model catalog.');
    }).finally(() => {
      if (!cancelled) setIsLoadingModels(false);
    });
    return () => { cancelled = true; };
  }, [params.status]);

  const categoryLabels = useMemo(() => new Map(categories.map(option => [option.id, option.label])), [categories]);
  const tagLabels = useMemo(() => new Map(tags.map(option => [option.id, option.label])), [tags]);
  const filteredModels = useMemo(() => {
    const q = params.q.trim().toLocaleLowerCase();
    const filtered = allModels.filter(model => {
      if (q && !searchable(model).includes(q)) return false;
      if (!containsAny(model.categoryIds, params.categories)) return false;
      return params.tagMatch === 'all'
        ? containsEvery(model.tagIds, params.tags)
        : containsAny(model.tagIds, params.tags);
    });
    return filtered.sort((left, right) => {
      const a = String(left[params.sort] ?? '');
      const b = String(right[params.sort] ?? '');
      const comparison = a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
      return params.order === 'desc' ? -comparison : comparison;
    });
  }, [allModels, params.categories, params.order, params.q, params.sort, params.tagMatch, params.tags]);

  const start = (params.page - 1) * params.pageSize;
  const models = filteredModels.slice(start, start + params.pageSize).map(model => ({
    ...model,
    categories: (model.categoryIds ?? []).map(id => categoryLabels.get(id) ?? id),
    tags: (model.tagIds ?? []).map(id => tagLabels.get(id) ?? id),
  }));

  return {
    categories,
    tagGroups: groupTags(tags),
    models,
    total: filteredModels.length,
    isLoadingOptions,
    isLoadingModels,
    error,
    taxonomyFiltersActive: params.categories.length > 0 || params.tags.length > 0,
  };
}
