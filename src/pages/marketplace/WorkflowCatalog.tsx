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
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddBoxIcon from '@mui/icons-material/AddBox';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WorkflowCatalogCard from './components/WorkflowCatalogCard';
import WorkflowCatalogFilters from './components/WorkflowCatalogFilters';
import {
  type WorkflowCatalogItem,
  type WorkflowCatalogParams,
  type WorkflowCatalogSortField,
  type WorkflowCatalogSortOrder,
  type WorkflowCatalogStatus,
  type WorkflowCatalogViewMode,
  type WorkflowTagMatchMode,
  buildPortalQueryUrl,
  parseWorkflowCatalogParams,
  useWorkflowCatalog,
} from './hooks/useWorkflowCatalog';
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';
import { defaultAllScopeRoles, ownershipScope } from '../../utils/ownershipScope';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildWorkflowTaskContext, buildWorkflowTaskRoute } from '../workflow/workflowTaskUtils';

const allWorkflowScopeRoles = [...defaultAllScopeRoles, 'workflow-admin'];

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
  patch: Partial<WorkflowCatalogParams>,
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
    if (patch.sort === 'name') next.delete('sort');
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

function compactDefinition(definition?: string) {
  return definition?.trim() || 'No definition available.';
}

export default function WorkflowCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { host, userId, roles, positions } = useUserState();
  const params = useMemo(() => parseWorkflowCatalogParams(searchParams), [searchParams]);
  const taskSearchParams = useMemo(() => new URLSearchParams(searchParams), [searchParams]);
  const taskContext = useMemo(
    () => buildWorkflowTaskContext(host || undefined, taskSearchParams, { hostId: host ?? '' }),
    [host, taskSearchParams],
  );
  const workflowOwnership = useMemo(
    () => ownershipScope({
      roles,
      userId,
      positions,
      ownerField: 'ownerUserId',
      allScopeRoles: allWorkflowScopeRoles,
    }),
    [roles, userId, positions],
  );

  const [updatingWfDefId, setUpdatingWfDefId] = useState<string | null>(null);
  const [detailWorkflow, setDetailWorkflow] = useState<WorkflowCatalogItem | null>(null);
  const {
    categories,
    tagGroups,
    workflows,
    total,
    isLoadingOptions,
    isLoadingWorkflows,
    error,
    taxonomyFiltersActive,
  } = useWorkflowCatalog({ host, params });

  const updateParams = useCallback(
    (patch: Partial<WorkflowCatalogParams>, resetPage = true) => {
      setSearchParams(updateSearchParams(searchParams, patch, resetPage));
    },
    [searchParams, setSearchParams],
  );

  const contextForWorkflow = useCallback(
    (workflow: WorkflowCatalogItem) => buildWorkflowTaskContext(host || undefined, taskSearchParams, workflow),
    [host, taskSearchParams],
  );

  const handleStart = useCallback((workflow: WorkflowCatalogItem) => {
    navigate(buildWorkflowTaskRoute('/app/form/startWorkflow', taskSearchParams, contextForWorkflow(workflow)), {
      state: {
        data: {
          hostId: workflow.hostId,
          wfDefId: workflow.wfDefId,
          input: '{}',
        },
        source: location.pathname,
      },
    });
  }, [contextForWorkflow, location.pathname, navigate, taskSearchParams]);

  const handleCreate = useCallback(() => {
    navigate(buildWorkflowTaskRoute('/app/workflow/editor', taskSearchParams, taskContext), {
      state: { data: { hostId: host }, source: location.pathname },
    });
  }, [host, location.pathname, navigate, taskContext, taskSearchParams]);

  const handleAdmin = useCallback(() => {
    navigate(buildWorkflowTaskRoute('/app/workflow/WfDefinition', taskSearchParams, taskContext));
  }, [navigate, taskContext, taskSearchParams]);

  const handleEdit = useCallback(async (workflow: WorkflowCatalogItem) => {
    if (!workflowOwnership.canModifyRecord(workflow)) {
      alert('You can only edit workflows you own.');
      return;
    }

    setUpdatingWfDefId(workflow.wfDefId);
    const url = buildPortalQueryUrl('workflow', 'getFreshWfDefinition', {
      hostId: workflow.hostId,
      wfDefId: workflow.wfDefId,
      aggregateVersion: workflow.aggregateVersion,
    });

    try {
      const freshData = await fetchClient(url);
      navigate(buildWorkflowTaskRoute('/app/workflow/editor', taskSearchParams, contextForWorkflow(workflow)), {
        state: { data: freshData, source: location.pathname },
      });
    } catch (e) {
      console.error('Failed to fetch workflow definition for edit:', e);
      alert('Could not load the latest workflow definition. Please try again.');
    } finally {
      setUpdatingWfDefId(null);
    }
  }, [contextForWorkflow, location.pathname, navigate, taskSearchParams, workflowOwnership]);

  const copyWorkflowId = useCallback(() => {
    if (!detailWorkflow?.wfDefId) return;
    navigator.clipboard?.writeText(detailWorkflow.wfDefId).catch(() => undefined);
  }, [detailWorkflow?.wfDefId]);

  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const isLoading = isLoadingOptions || isLoadingWorkflows;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Workflow Catalog
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'workflow' : 'workflows'} found{taxonomyFiltersActive ? ' for the selected taxonomy filters' : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
          <Button variant="outlined" startIcon={<AdminPanelSettingsIcon />} onClick={handleAdmin}>
            Workflow Admin
          </Button>
          <Button variant="contained" startIcon={<AddBoxIcon />} onClick={handleCreate}>
            Create Workflow
          </Button>
        </Stack>
      </Stack>

      <TaskActionPanel
        title="Workflow Tasks"
        context={taskContext}
        taskIds={['manage-workflow']}
        maxActions={3}
      />

      <Box sx={{ mt: 2 }}>
        {!host && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Host context is required before the workflow catalog can be loaded.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <WorkflowCatalogFilters
          params={params}
          categories={categories}
          tagGroups={tagGroups}
          isLoading={isLoading}
          onSearchChange={(q) => updateParams({ q })}
          onCategoryToggle={(category) => updateParams({ categories: toggleValue(params.categories, category) })}
          onTagToggle={(tag) => updateParams({ tags: toggleValue(params.tags, tag) })}
          onTagMatchChange={(tagMatch: WorkflowTagMatchMode) => updateParams({ tagMatch })}
          onStatusChange={(status: WorkflowCatalogStatus) => updateParams({ status })}
          onSortChange={(sort: WorkflowCatalogSortField) => updateParams({ sort })}
          onOrderChange={(order: WorkflowCatalogSortOrder) => updateParams({ order })}
          onViewChange={(view: WorkflowCatalogViewMode) => updateParams({ view }, false)}
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
        {isLoadingWorkflows ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : workflows.length === 0 ? (
          <Alert severity="info">No workflows match the current catalog filters.</Alert>
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
            {workflows.map((workflow) => (
              <WorkflowCatalogCard
                key={workflow.wfDefId}
                workflow={workflow}
                viewMode={params.view}
                canModify={workflowOwnership.canModifyRecord(workflow)}
                isUpdating={updatingWfDefId === workflow.wfDefId}
                onDetails={setDetailWorkflow}
                onStart={handleStart}
                onEdit={handleEdit}
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
        open={!!detailWorkflow}
        onClose={() => setDetailWorkflow(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, p: 2 } }}
      >
        {detailWorkflow && (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <AccountTreeIcon color="primary" sx={{ mt: 0.5 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                  {detailWorkflow.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {[detailWorkflow.namespace, detailWorkflow.version].filter(Boolean).join(' / ')}
                </Typography>
              </Box>
              <IconButton aria-label="Close details" onClick={() => setDetailWorkflow(null)}>
                <CloseIcon />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={copyWorkflowId}>
                Copy ID
              </Button>
              <Button size="small" variant="contained" startIcon={<AddBoxIcon />} onClick={() => handleStart(detailWorkflow)}>
                Start
              </Button>
            </Stack>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Workflow Definition Id</Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{detailWorkflow.wfDefId}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Status</Typography>
              <Typography variant="body2">
                {detailWorkflow.active ? 'Active' : 'Inactive'} / {detailWorkflow.catalogVisible ? 'Published' : 'Private'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Taxonomy</Typography>
              <Typography variant="body2">
                Categories: {(detailWorkflow.categories ?? []).join(', ') || 'Uncategorized'}
              </Typography>
              <Typography variant="body2">
                Tags: {(detailWorkflow.tags ?? []).join(', ') || 'No tags'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Metadata</Typography>
              <Typography variant="body2">Owner: {detailWorkflow.ownerUserId || 'Not set'}</Typography>
              <Typography variant="body2">Owner position: {detailWorkflow.ownerPositionId || 'Not set'}</Typography>
              <Typography variant="body2">Updated by: {detailWorkflow.updateUser || 'Not set'}</Typography>
              <Typography variant="body2">Updated: {detailWorkflow.updateTs ? new Date(detailWorkflow.updateTs).toLocaleString() : 'Not set'}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Definition Preview</Typography>
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
                {compactDefinition(detailWorkflow.definition)}
              </Box>
            </Box>
          </Stack>
        )}
      </Drawer>
    </Box>
  );
}
