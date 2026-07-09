import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Pagination,
  Stack,
  Typography,
} from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ApiCatalogCard from './components/ApiCatalogCard';
import ApiCatalogFilters from './components/ApiCatalogFilters';
import {
  type ApiCatalogItem,
  type ApiCatalogParams,
  type ApiCatalogSummary,
  type CatalogSortField,
  type CatalogSortOrder,
  type CatalogStatus,
  type CatalogViewMode,
  type TagMatchMode,
  buildPortalQueryUrl,
  parseApiCatalogParams,
  useApiCatalog,
} from './hooks/useApiCatalog';
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';
import { ownershipScope } from '../../utils/ownershipScope';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

function setRepeatedParam(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key);
  for (const value of values) params.append(key, value);
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function updateSearchParams(
  current: URLSearchParams,
  patch: Partial<ApiCatalogParams>,
  resetPage = true,
) {
  const next = new URLSearchParams(current);

  if (patch.q !== undefined) {
    if (patch.q.trim()) next.set('q', patch.q);
    else next.delete('q');
  }
  if (patch.categories !== undefined) setRepeatedParam(next, 'category', patch.categories);
  if (patch.tags !== undefined) setRepeatedParam(next, 'tag', patch.tags);
  if (patch.tagMatch !== undefined) {
    if (patch.tagMatch === 'all') next.delete('tagMatch');
    else next.set('tagMatch', patch.tagMatch);
  }
  if (patch.status !== undefined) {
    if (patch.status === 'active') next.delete('status');
    else next.set('status', patch.status);
  }
  if (patch.pageSize !== undefined) next.set('pageSize', String(patch.pageSize));
  if (patch.sort !== undefined) {
    if (patch.sort === 'apiName') next.delete('sort');
    else next.set('sort', patch.sort);
  }
  if (patch.order !== undefined) {
    if (patch.order === 'asc') next.delete('order');
    else next.set('order', patch.order);
  }
  if (patch.view !== undefined) {
    if (patch.view === 'grid') next.delete('view');
    else next.set('view', patch.view);
  }

  if (patch.page !== undefined) {
    if (patch.page <= 1) next.delete('page');
    else next.set('page', String(patch.page));
  } else if (resetPage) {
    next.delete('page');
  }

  return next;
}

function toApiFormData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const data = { ...(value as Record<string, unknown>) };
  delete data.tags;
  delete data.categories;
  return data;
}

export default function ApiCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { host, userId, email, roles, positions } = useUserState();
  const params = useMemo(() => parseApiCatalogParams(searchParams), [searchParams]);
  const taskSearchParams = useMemo(() => new URLSearchParams(searchParams), [searchParams]);
  const searchContext = useMemo(() => contextFromSearchParams(taskSearchParams), [taskSearchParams]);
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId: host ?? '', userId: userId ?? '' }),
    [host, searchContext, userId],
  );
  const apiOwnership = useMemo(
    () => ownershipScope({
      roles,
      userId,
      positions,
      ownerField: 'ownerUserId',
    }),
    [roles, userId, positions],
  );

  const [updatingApiId, setUpdatingApiId] = useState<string | null>(null);
  const {
    categories,
    tagGroups,
    apis,
    summaries,
    total,
    isLoadingOptions,
    isLoadingApis,
    isLoadingSummaries,
    error,
    taxonomyFiltersActive,
  } = useApiCatalog({ host, params });

  const updateParams = useCallback(
    (patch: Partial<ApiCatalogParams>, resetPage = true) => {
      setSearchParams(updateSearchParams(searchParams, patch, resetPage));
    },
    [searchParams, setSearchParams],
  );

  const handleDetails = useCallback((api: ApiCatalogItem) => {
    navigate(buildTaskAwareRoute('/app/apiDetail', taskSearchParams, {
      ...taskContext,
      hostId: api.hostId,
      apiId: api.apiId,
    }), { state: { service: api } });
  }, [navigate, taskContext, taskSearchParams]);

  const handleCreateVersion = useCallback((api: ApiCatalogItem) => {
    navigate(buildTaskAwareRoute('/app/form/createApiVersion', taskSearchParams, {
      ...taskContext,
      hostId: api.hostId,
      apiId: api.apiId,
    }), { state: { data: { hostId: api.hostId, apiId: api.apiId } } });
  }, [navigate, taskContext, taskSearchParams]);

  const handleOpenEndpoints = useCallback((api: ApiCatalogItem, summary?: ApiCatalogSummary) => {
    if (!summary?.latestVersionId) return;
    navigate(buildTaskAwareRoute('/app/serviceEndpoint', taskSearchParams, {
      ...taskContext,
      hostId: api.hostId,
      apiId: api.apiId,
      apiVersionId: summary.latestVersionId,
    }), {
      state: {
        data: {
          hostId: api.hostId,
          apiId: api.apiId,
          apiVersionId: summary.latestVersionId,
        },
      },
    });
  }, [navigate, taskContext, taskSearchParams]);

  const handleUpdate = useCallback(async (api: ApiCatalogItem) => {
    if (!apiOwnership.canModifyRecord(api)) {
      alert('You can only update APIs you own.');
      return;
    }

    setUpdatingApiId(api.apiId);
    const url = buildPortalQueryUrl('service', 'getFreshApi', {
      hostId: api.hostId,
      apiId: api.apiId,
      aggregateVersion: api.aggregateVersion,
    });

    try {
      const freshData = await fetchClient(url);
      const dataForForm = freshData.aggregateVersion === api.aggregateVersion ? api : freshData;
      navigate(buildTaskAwareRoute('/app/form/updateApi', taskSearchParams, {
        ...taskContext,
        hostId: api.hostId,
        apiId: api.apiId,
      }), { state: { data: toApiFormData(dataForForm), source: location.pathname } });
    } catch (e) {
      console.error('Failed to fetch API for update:', e);
      alert('Could not load the latest API data. Please try again.');
    } finally {
      setUpdatingApiId(null);
    }
  }, [apiOwnership, location.pathname, navigate, taskContext, taskSearchParams]);

  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const isLoading = isLoadingOptions || isLoadingApis;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            API Catalog
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'API' : 'APIs'} found{taxonomyFiltersActive ? ' for the selected taxonomy filters' : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<AdminPanelSettingsIcon />}
            onClick={() => navigate(buildTaskAwareRoute('/app/service/admin', taskSearchParams, taskContext))}
          >
            API Admin
          </Button>
          <Button
            variant="contained"
            startIcon={<AddBoxIcon />}
            onClick={() => navigate(buildTaskAwareRoute('/app/form/createApi', taskSearchParams, taskContext))}
          >
            Create API
          </Button>
        </Stack>
      </Stack>

      <TaskActionPanel
        title="API Tasks"
        context={taskContext}
        taskIds={['publish-api', 'mcp-onboard-api', 'register-standalone-mcp-server', 'configure-access-control']}
        maxActions={4}
      />

      <Box sx={{ mt: 2 }}>
        {!host && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Host context is required before the API catalog can be loaded.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <ApiCatalogFilters
          params={params}
          categories={categories}
          tagGroups={tagGroups}
          isLoading={isLoading}
          onSearchChange={(q) => updateParams({ q })}
          onCategoryToggle={(category) => updateParams({ categories: toggleValue(params.categories, category) })}
          onTagToggle={(tag) => updateParams({ tags: toggleValue(params.tags, tag) })}
          onTagMatchChange={(tagMatch: TagMatchMode) => updateParams({ tagMatch })}
          onStatusChange={(status: CatalogStatus) => updateParams({ status })}
          onSortChange={(sort: CatalogSortField) => updateParams({ sort })}
          onOrderChange={(order: CatalogSortOrder) => updateParams({ order })}
          onViewChange={(view: CatalogViewMode) => updateParams({ view }, false)}
          onClear={() => updateParams({
            q: '',
            categories: [],
            tags: [],
            tagMatch: 'all',
            status: 'active',
          })}
        />
      </Box>

      <Box sx={{ mt: 2, minHeight: 220 }}>
        {isLoadingApis ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : apis.length === 0 ? (
          <Alert severity="info">No APIs match the current catalog filters.</Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: params.view === 'list'
                ? '1fr'
                : 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
              gap: 2,
            }}
          >
            {apis.map((api) => (
              <ApiCatalogCard
                key={api.apiId}
                api={api}
                summary={summaries[api.apiId]}
                isSummaryLoading={isLoadingSummaries}
                viewMode={params.view}
                canModify={apiOwnership.canModifyRecord(api)}
                isUpdating={updatingApiId === api.apiId}
                onDetails={handleDetails}
                onOpenEndpoints={handleOpenEndpoints}
                onCreateVersion={handleCreateVersion}
                onUpdate={handleUpdate}
              />
            ))}
          </Box>
        )}
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Page {Math.min(params.page, totalPages)} of {totalPages}
        </Typography>
        <Pagination
          page={Math.min(params.page, totalPages)}
          count={totalPages}
          color="primary"
          onChange={(_, page) => updateParams({ page }, false)}
        />
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Page size
          </Typography>
          {[12, 24, 48].map((size) => (
            <Button
              key={size}
              size="small"
              variant={params.pageSize === size ? 'contained' : 'outlined'}
              onClick={() => updateParams({ pageSize: size })}
            >
              {size}
            </Button>
          ))}
        </Stack>
      </Stack>

      {apiOwnership.ownedOnly && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Owner-scoped view: {email || userId || 'current user'}
        </Typography>
      )}
    </Box>
  );
}
