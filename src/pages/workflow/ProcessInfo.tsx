import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, Tab, Tabs, Typography } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef, type MRT_Row } from 'material-react-table';
import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { PAGE_SIZE_OPTIONS, usePersistentPagination } from '../../hooks/usePersistentPagination';
import { buildWorkflowTaskContext, WorkflowTaskLayout } from './workflowTaskUtils';
import { workflowAdminClient } from './workflowAdminClient';

type ActionHint = { allowed: boolean; reason?: string | null };
type ProcessInfoType = {
    processId: string;
    workflowInstanceId?: string | null;
    featureRunId?: string | null;
    definitionId: string;
    workflowName: string;
    workflowVersion: string;
    processState: string;
    invocationState?: string | null;
    createdAt: string;
    updatedAt: string;
    deadline?: string | null;
    safeFailureSummary?: string | null;
    canCancelInvocation: ActionHint;
    canCancelFeature: ActionHint;
};
type FeatureType = {
    featureRunId: string;
    featureVersion: number;
    state: string;
    holdsVm: boolean;
    vmState: string;
    vmGeneration?: number | null;
    activeWorkflowInstanceId?: string | null;
    canCancelFeature: ActionHint;
};

const date = (value?: string | null) => value ? new Date(value).toLocaleString() : '';

export default function ProcessInfo() {
    const location = useLocation();
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskContext = useMemo(() => buildWorkflowTaskContext(undefined, searchParams), [searchParams]);
    const [data, setData] = useState<ProcessInfoType[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [pagination, setPagination] = usePersistentPagination();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mutating, setMutating] = useState<string | null>(null);
    const [view, setView] = useState<'processes' | 'features'>('processes');
    const [features, setFeatures] = useState<FeatureType[]>([]);
    const [featuresHoldingVm, setFeaturesHoldingVm] = useState(false);
    const [detail, setDetail] = useState<any | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await workflowAdminClient.listProcesses({
                page: { cursor: String(pagination.pageIndex * pagination.pageSize), pageSize: pagination.pageSize },
                sort: 'createdAt:desc',
            });
            setData(result.processes || []);
            const page = result.page || {};
            setRowCount(page.authorizedTotal ?? (pagination.pageIndex * pagination.pageSize + (result.processes?.length || 0) + (page.hasMore ? 1 : 0)));
        } catch (cause: any) {
            setError(cause?.message || 'Unable to load Workflow processes.');
        } finally {
            setLoading(false);
        }
    }, [pagination.pageIndex, pagination.pageSize]);

    useEffect(() => { void load(); }, [load]);

    const loadFeatures = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await workflowAdminClient.listFeatures({
                page: { pageSize: 100 },
                ...(featuresHoldingVm ? { holdsVm: true } : {}),
            });
            setFeatures(result.features || []);
        } catch (cause: any) {
            setError(cause?.message || 'Unable to load Workflow features.');
        } finally {
            setLoading(false);
        }
    }, [featuresHoldingVm]);

    useEffect(() => { if (view === 'features') void loadFeatures(); }, [loadFeatures, view]);

    const cancel = useCallback(async (row: ProcessInfoType) => {
        if (!row.workflowInstanceId || !window.confirm(`Request cancellation for invocation ${row.workflowInstanceId}?`)) return;
        setMutating(row.processId);
        setError(null);
        try {
            await workflowAdminClient.cancelInvocation(row.workflowInstanceId);
            await load();
        } catch (cause: any) {
            setError(cause?.message || 'Unable to request cancellation.');
        } finally {
            setMutating(null);
        }
    }, [load]);

    const cancelFeature = useCallback(async (feature: FeatureType) => {
        if (!window.confirm(`Cancel feature ${feature.featureRunId} and release its VM reservation?`)) return;
        setMutating(feature.featureRunId);
        setError(null);
        try {
            await workflowAdminClient.cancelFeature(feature.featureRunId, feature.featureVersion);
            await loadFeatures();
        } catch (cause: any) {
            setError(cause?.message || 'Unable to cancel the feature. Refresh before retrying a stale version.');
        } finally {
            setMutating(null);
        }
    }, [loadFeatures]);

    const open = useCallback(async (row: MRT_Row<ProcessInfoType>) => {
        setLoading(true);
        setError(null);
        try {
            setDetail(await workflowAdminClient.getProcess(row.original.processId));
        } catch (cause: any) {
            setError(cause?.message || 'Unable to load process detail.');
        } finally {
            setLoading(false);
        }
    }, []);

    const columns = useMemo<MRT_ColumnDef<ProcessInfoType>[]>(() => [
        { accessorKey: 'processState', header: 'Process', Cell: ({ cell }) => <Chip size="small" label={cell.getValue<string>()} /> },
        { accessorKey: 'invocationState', header: 'Invocation', Cell: ({ cell }) => <Chip size="small" variant="outlined" label={cell.getValue<string>() || 'Unlinked'} /> },
        { accessorKey: 'workflowName', header: 'Workflow' },
        { accessorKey: 'workflowVersion', header: 'Version' },
        { accessorKey: 'processId', header: 'Process Id' },
        { accessorKey: 'workflowInstanceId', header: 'Invocation Id' },
        { accessorKey: 'featureRunId', header: 'Feature Id' },
        { accessorKey: 'createdAt', header: 'Created', Cell: ({ cell }) => date(cell.getValue<string>()) },
        { accessorKey: 'updatedAt', header: 'Updated', Cell: ({ cell }) => date(cell.getValue<string>()) },
        { accessorKey: 'deadline', header: 'Deadline', Cell: ({ cell }) => date(cell.getValue<string | null>()) },
        { accessorKey: 'safeFailureSummary', header: 'Failure' },
    ], []);

    const table = useMaterialReactTable(usePortalActionTableOptions({
        columns, data, manualPagination: true, rowCount,
        state: { isLoading: loading, pagination }, onPaginationChange: setPagination,
        muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS }, getRowId: row => row.processId,
        enableRowActions: true, positionActionsColumn: 'first',
        renderRowActions: ({ row }) => <PortalActions row={row} actions={[
            { id: 'open-process', label: 'Open Process', icon: <OpenInNewIcon />, onSelect: () => open(row) },
            { id: 'cancel-invocation', label: 'Cancel Invocation', icon: <CancelIcon />, destructive: true,
                loading: () => mutating === row.original.processId,
                disabledReason: () => row.original.canCancelInvocation?.allowed ? null : (row.original.canCancelInvocation?.reason || 'Invocation cannot be cancelled.'),
                onSelect: () => cancel(row.original) },
        ]} />,
        renderTopToolbarCustomActions: () => <Button startIcon={<RefreshIcon />} onClick={() => void load()}>Refresh</Button>,
    }));

    const featureColumns = useMemo<MRT_ColumnDef<FeatureType>[]>(() => [
        { accessorKey: 'state', header: 'Feature', Cell: ({ cell }) => <Chip size="small" label={cell.getValue<string>()} /> },
        { accessorKey: 'vmState', header: 'VM', Cell: ({ cell }) => <Chip size="small" variant="outlined" label={cell.getValue<string>()} /> },
        { accessorKey: 'featureRunId', header: 'Feature Id' },
        { accessorKey: 'featureVersion', header: 'Version' },
        { accessorKey: 'vmGeneration', header: 'VM Generation' },
        { accessorKey: 'activeWorkflowInstanceId', header: 'Active Invocation' },
    ], []);
    const featureTable = useMaterialReactTable(usePortalActionTableOptions({
        columns: featureColumns, data: features, state: { isLoading: loading }, getRowId: row => row.featureRunId,
        enableRowActions: true, positionActionsColumn: 'first',
        renderRowActions: ({ row }) => <PortalActions row={row} actions={[
            { id: 'cancel-feature', label: 'Cancel feature and release VM', icon: <CancelIcon />, destructive: true,
                loading: () => mutating === row.original.featureRunId,
                disabledReason: () => row.original.canCancelFeature?.allowed ? null : (row.original.canCancelFeature?.reason || 'Feature cannot be cancelled.'),
                onSelect: () => cancelFeature(row.original) },
        ]} />,
        renderTopToolbarCustomActions: () => <Stack direction="row" spacing={2} alignItems="center">
            <Button startIcon={<RefreshIcon />} onClick={() => void loadFeatures()}>Refresh</Button>
            <FormControlLabel control={<Switch checked={featuresHoldingVm} onChange={(_, checked) => setFeaturesHoldingVm(checked)} />} label="Holding VM only" />
        </Stack>,
    }));

    return <WorkflowTaskLayout context={taskContext}>
        <Stack spacing={2}>
            <Tabs value={view} onChange={(_, value) => setView(value)}>
                <Tab value="processes" label="Processes" />
                <Tab value="features" label="Features / VM reservations" />
            </Tabs>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <PortalActionScope><MaterialReactTable table={view === 'processes' ? table : featureTable} /></PortalActionScope>
            <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
                <DialogTitle>Workflow process</DialogTitle>
                <DialogContent><Stack spacing={1}>
                    <Typography>Process: {detail?.process?.processId}</Typography>
                    <Typography>Invocation: {detail?.process?.workflowInstanceId || 'Unlinked'}</Typography>
                    <Typography>Feature: {detail?.process?.featureRunId || 'None'}</Typography>
                    <Typography>State: {detail?.process?.processState} / {detail?.process?.invocationState || 'Unlinked'}</Typography>
                    <Typography variant="h6">Tasks</Typography>
                    {(detail?.tasks || []).map((task: any) => <Typography key={task.taskId} variant="body2">
                        {task.taskId} — {task.type} — {task.state}{task.taskAsstId ? ` — assignment ${task.taskAsstId}` : ''}
                    </Typography>)}
                </Stack></DialogContent>
                <DialogActions><Button onClick={() => setDetail(null)}>Close</Button></DialogActions>
            </Dialog>
        </Stack>
    </WorkflowTaskLayout>;
}
