import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Pagination,
  Stack,
  Typography,
} from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SchemaIcon from '@mui/icons-material/Schema';
import SchemaCatalogCard from './components/SchemaCatalogCard';
import SchemaCatalogFilters from './components/SchemaCatalogFilters';
import {
  type SchemaCatalogItem,
  type SchemaCatalogParams,
  type SchemaCatalogSortField,
  type SchemaCatalogSortOrder,
  type SchemaCatalogStatus,
  type SchemaCatalogViewMode,
  type SchemaTagMatchMode,
  buildPortalQueryUrl,
  parseSchemaCatalogParams,
  schemaExternalPath,
  useSchemaCatalog,
} from './hooks/useSchemaCatalog';
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';
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
  patch: Partial<SchemaCatalogParams>,
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
    if (patch.sort === 'schemaName') next.delete('sort');
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

function schemaStatusLabel(status?: string) {
  switch (status) {
    case 'D':
      return 'Draft';
    case 'P':
      return 'Published';
    case 'R':
      return 'Retired';
    default:
      return status || 'Unknown';
  }
}

function prettySchemaBody(value?: string) {
  if (!value?.trim()) return 'No schema body available.';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function toSchemaFormData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const data = { ...(value as Record<string, unknown>) };
  delete data.tags;
  delete data.categories;
  return data;
}

export default function SchemaCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { host, userId } = useUserState();
  const params = useMemo(() => parseSchemaCatalogParams(searchParams), [searchParams]);
  const taskSearchParams = useMemo(() => new URLSearchParams(searchParams), [searchParams]);
  const searchContext = useMemo(() => contextFromSearchParams(taskSearchParams), [taskSearchParams]);
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId: host ?? '', userId: userId ?? '' }),
    [host, searchContext, userId],
  );

  const [updatingSchemaId, setUpdatingSchemaId] = useState<string | null>(null);
  const [detailSchema, setDetailSchema] = useState<SchemaCatalogItem | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const {
    categories,
    tagGroups,
    schemas,
    total,
    isLoadingOptions,
    isLoadingSchemas,
    error,
    taxonomyFiltersActive,
  } = useSchemaCatalog({ host, params });

  const updateParams = useCallback(
    (patch: Partial<SchemaCatalogParams>, resetPage = true) => {
      setSearchParams(updateSearchParams(searchParams, patch, resetPage));
    },
    [searchParams, setSearchParams],
  );

  const contextForSchema = useCallback((schema: SchemaCatalogItem) => ({
    ...taskContext,
    hostId: schema.hostId ?? host ?? '',
    schemaId: schema.schemaId,
    schemaVersion: schema.schemaVersion,
  }), [host, taskContext]);

  const handleDetails = useCallback(async (schema: SchemaCatalogItem) => {
    setDetailSchema(schema);
    setIsDetailLoading(true);
    const url = buildPortalQueryUrl('schema', 'getSchemaById', {
      schemaId: schema.schemaId,
    });

    try {
      const freshData = await fetchClient(url) as SchemaCatalogItem;
      setDetailSchema({ ...schema, ...freshData });
    } catch (e) {
      console.error('Failed to fetch schema details:', e);
      setDetailSchema(schema);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const copyExternalUrl = useCallback((schema: SchemaCatalogItem) => {
    const path = schemaExternalPath(schema);
    if (!path) return;
    const url = new URL(path, window.location.origin).toString();
    navigator.clipboard?.writeText(url).catch(() => undefined);
  }, []);

  const openExternalUrl = useCallback((schema: SchemaCatalogItem) => {
    const path = schemaExternalPath(schema);
    if (!path) return;
    window.open(path, '_blank', 'noopener,noreferrer');
  }, []);

  const handleAdmin = useCallback(() => {
    navigate(buildTaskAwareRoute('/app/schema/admin', taskSearchParams, taskContext));
  }, [navigate, taskContext, taskSearchParams]);

  const handleCreate = useCallback(() => {
    navigate(buildTaskAwareRoute('/app/form/createSchema', taskSearchParams, taskContext), {
      state: { data: { hostId: host }, source: location.pathname },
    });
  }, [host, location.pathname, navigate, taskContext, taskSearchParams]);

  const handleUpdate = useCallback(async (schema: SchemaCatalogItem) => {
    setUpdatingSchemaId(schema.schemaId);
    const url = buildPortalQueryUrl('schema', 'getFreshSchema', {
      hostId: schema.hostId ?? host,
      schemaId: schema.schemaId,
      aggregateVersion: schema.aggregateVersion,
    });

    try {
      const freshData = await fetchClient(url);
      navigate(buildTaskAwareRoute('/app/form/updateSchema', taskSearchParams, contextForSchema(schema)), {
        state: { data: toSchemaFormData(freshData), source: location.pathname },
      });
    } catch (e) {
      console.error('Failed to fetch schema for update:', e);
      alert('Could not load the latest schema data. Please try again.');
    } finally {
      setUpdatingSchemaId(null);
    }
  }, [contextForSchema, host, location.pathname, navigate, taskSearchParams]);

  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const isLoading = isLoadingOptions || isLoadingSchemas;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Schema Catalog
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'schema' : 'schemas'} found{taxonomyFiltersActive ? ' for the selected taxonomy filters' : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
          <Button variant="outlined" startIcon={<AdminPanelSettingsIcon />} onClick={handleAdmin}>
            Schema Admin
          </Button>
          <Button variant="contained" startIcon={<AddBoxIcon />} onClick={handleCreate}>
            Create Schema
          </Button>
        </Stack>
      </Stack>

      <TaskActionPanel
        title="Schema Tasks"
        context={taskContext}
        taskIds={['manage-schema-rules']}
        maxActions={3}
      />

      <Box sx={{ mt: 2 }}>
        {!host && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Host context is required before the schema catalog can be loaded.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <SchemaCatalogFilters
          params={params}
          categories={categories}
          tagGroups={tagGroups}
          isLoading={isLoading}
          onSearchChange={(q) => updateParams({ q })}
          onCategoryToggle={(category) => updateParams({ categories: toggleValue(params.categories, category) })}
          onTagToggle={(tag) => updateParams({ tags: toggleValue(params.tags, tag) })}
          onTagMatchChange={(tagMatch: SchemaTagMatchMode) => updateParams({ tagMatch })}
          onStatusChange={(status: SchemaCatalogStatus) => updateParams({ status })}
          onSortChange={(sort: SchemaCatalogSortField) => updateParams({ sort })}
          onOrderChange={(order: SchemaCatalogSortOrder) => updateParams({ order })}
          onViewChange={(view: SchemaCatalogViewMode) => updateParams({ view }, false)}
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
        {isLoadingSchemas ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : schemas.length === 0 ? (
          <Alert severity="info">No schemas match the current catalog filters.</Alert>
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
            {schemas.map((schema) => (
              <SchemaCatalogCard
                key={schema.schemaId}
                schema={schema}
                viewMode={params.view}
                isUpdating={updatingSchemaId === schema.schemaId}
                onDetails={handleDetails}
                onCopyUrl={copyExternalUrl}
                onOpenUrl={openExternalUrl}
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

      <Drawer
        anchor="right"
        open={!!detailSchema}
        onClose={() => setDetailSchema(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, p: 2 } }}
      >
        {detailSchema && (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <SchemaIcon color="primary" sx={{ mt: 0.5 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                  {detailSchema.schemaName || detailSchema.schemaAlias || detailSchema.schemaId}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {[detailSchema.schemaType, detailSchema.specVersion, detailSchema.schemaVersion].filter(Boolean).join(' / ')}
                </Typography>
              </Box>
              <IconButton aria-label="Close details" onClick={() => setDetailSchema(null)}>
                <CloseIcon />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} disabled={!schemaExternalPath(detailSchema)} onClick={() => copyExternalUrl(detailSchema)}>
                Copy URL
              </Button>
              {isDetailLoading && <CircularProgress size={24} />}
            </Stack>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Schema Id</Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{detailSchema.schemaId}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>External Access</Typography>
              <Typography variant="body2">
                {detailSchema.externalVisible && detailSchema.schemaAlias ? schemaExternalPath(detailSchema) : 'Private'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Status</Typography>
              <Typography variant="body2">
                {detailSchema.active ? 'Active' : 'Inactive'} / {schemaStatusLabel(detailSchema.schemaStatus)}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Taxonomy</Typography>
              <Typography variant="body2">
                Categories: {(detailSchema.categories ?? []).join(', ') || 'Uncategorized'}
              </Typography>
              <Typography variant="body2">
                Tags: {(detailSchema.tags ?? []).join(', ') || 'No tags'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Metadata</Typography>
              <Typography variant="body2">Source: {detailSchema.schemaSource || 'Not set'}</Typography>
              <Typography variant="body2">Owner: {detailSchema.schemaOwner || 'Not set'}</Typography>
              <Typography variant="body2">Updated by: {detailSchema.updateUser || 'Not set'}</Typography>
              <Typography variant="body2">Updated: {detailSchema.updateTs ? new Date(detailSchema.updateTs).toLocaleString() : 'Not set'}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Schema Body</Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  maxHeight: 360,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {prettySchemaBody(detailSchema.schemaBody)}
              </Box>
            </Box>
          </Stack>
        )}
      </Drawer>
    </Box>
  );
}
