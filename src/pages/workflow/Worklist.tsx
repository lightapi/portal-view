import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_Row,
} from 'material-react-table';
import { Alert, Box, Button, Chip, FormControlLabel, Stack, Switch, Tab, Tabs, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useUserState } from '../../contexts/UserContext';
import { buildWorkflowTaskContext, buildWorkflowTaskRoute, WorkflowTaskLayout } from './workflowTaskUtils';
import { workflowAdminClient } from './workflowAdminClient';
import type {BindingSummary} from './WfToolBindings';

type InboxTab = {
    id: string;
    label: string;
    assignmentType?: string | null;
    assignmentId?: string | null;
    count: number;
};

type HumanTaskRow = {
    hostId: string;
    taskAsstId: string;
    assignmentVersion: number;
    taskId: string;
    processId?: string;
    wfInstanceId?: string;
    wfTaskId?: string;
    assignedTs?: string;
    assigneeId?: string;
    assignmentType?: string;
    assignmentId?: string;
    assignmentLabel?: string;
    assignmentStatus?: string;
    claimedBy?: string;
    claimedTs?: string;
    claimExpiresTs?: string;
    deadlineTs?: string;
    categoryCode?: string;
    reasonCode?: string;
    taskStatusCode?: string;
    taskType?: string;
    active?: boolean;
    canClaim?: boolean;
    canRelease?: boolean;
    canComplete?: boolean;
    readOnly?: boolean;
    ask?: {
        prompt?: string;
        mode?: string;
    };
    workflow?: {
        namespace?: string;
        name?: string;
        version?: string;
    };
};

interface UserState {
    host?: string | null;
}

function formatDate(value?: string) {
    return value ? new Date(value).toLocaleString() : '';
}

function statusChip(status?: string, claimedBy?: string) {
    const color = status === 'CLAIMED' ? 'warning' : status === 'ASSIGNED' ? 'success' : 'default';
    const label = status === 'CLAIMED' && claimedBy ? `${status}: ${claimedBy}` : status || '';
    return <Chip size="small" color={color} label={label} />;
}

function workflowLabel(row: HumanTaskRow) {
    const workflow = row.workflow;
    if (!workflow?.name) return row.wfTaskId || row.taskId;
    return [workflow.namespace, workflow.name, workflow.version].filter(Boolean).join(':');
}

export default function Worklist() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskContext = useMemo(() => buildWorkflowTaskContext(host || undefined, searchParams), [host, searchParams]);

    const [tabs, setTabs] = useState<InboxTab[]>([]);
    const [activeTab, setActiveTab] = useState('all');
    const [showLocked, setShowLocked] = useState(false);
    const [data, setData] = useState<HumanTaskRow[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [bindingApprovals, setBindingApprovals] = useState<BindingSummary[]>([]);
    const [bindingError, setBindingError] = useState('');
    const [bindingLoading, setBindingLoading] = useState(false);
    const [pagination, setPagination] = usePersistentPagination();

    const fetchSummary = useCallback(async (background = false) => {
        if (!host) return;
        if (background) setIsRefetching(true);
        setError(null);

        try {
            const json = await workflowAdminClient.inboxSummary();
            const nextTabs = json.tabs || [];
            setTabs(nextTabs);
            if (nextTabs.length > 0 && !nextTabs.some((tab: InboxTab) => tab.id === activeTab)) {
                setActiveTab(nextTabs[0].id);
            }
        } catch (e: any) {
            setError(e?.description || e?.message || 'Unable to load worklist summary.');
        } finally {
            setIsRefetching(false);
        }
    }, [activeTab, host]);

    const fetchData = useCallback(async (background = false) => {
        if (!host || !activeTab) return;
        if (background) {
            setIsRefetching(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const json = await workflowAdminClient.listHumanTasks({
                page: {
                    cursor: String(pagination.pageIndex * pagination.pageSize),
                    pageSize: pagination.pageSize,
                },
                tabId: activeTab,
                includeClaimed: true,
                includeClaimedByOthers: showLocked,
            });
            setData((json.humanTasks || []).map((task: any) => ({
                ...task,
                assignmentStatus: task.assignmentStatus,
                assignedTs: task.assignedAt,
                claimExpiresTs: task.claimExpiresAt,
                deadlineTs: task.deadline,
                categoryCode: task.category,
                reasonCode: task.reason,
                taskStatusCode: task.taskStatus,
                ask: { prompt: task.prompt },
                canClaim: Boolean(task.canClaim?.allowed),
                canRelease: Boolean(task.canRelease?.allowed),
                canComplete: Boolean(task.canComplete?.allowed),
            })));
            setRowCount(json.total || 0);
        } catch (e: any) {
            setError(e?.description || e?.message || 'Unable to load worklist tasks.');
        } finally {
            setIsLoading(false);
            setIsRefetching(false);
        }
    }, [activeTab, host, pagination.pageIndex, pagination.pageSize, showLocked]);

    const fetchBindingApprovals = useCallback(async () => {
        if (!host) return;
        setBindingLoading(true); setBindingError('');
        try {
            const rows: BindingSummary[] = [];
            let cursor: string | undefined;
            do {
                const page = await workflowAdminClient.listBindings({hostId: host, role: 'owner',
                    status: 'pendingApproval', limit: 100, ...(cursor ? {cursor} : {})});
                rows.push(...(page.items ?? []));
                cursor = page.nextCursor;
            } while (cursor);
            setBindingApprovals(rows);
        } catch (reason: any) { setBindingError(reason?.message ?? 'Could not load Tool binding approvals.'); }
        finally { setBindingLoading(false); }
    }, [host]);

    useEffect(() => {
        fetchSummary(false);
    }, [fetchSummary]);

    useEffect(() => {
        fetchData(false);
    }, [fetchData]);
    useEffect(() => { void fetchBindingApprovals(); }, [fetchBindingApprovals]);

    useEffect(() => {
        const id = window.setInterval(() => {
            fetchSummary(true);
            fetchData(true);
            void fetchBindingApprovals();
        }, 15000);
        return () => window.clearInterval(id);
    }, [fetchBindingApprovals, fetchData, fetchSummary]);

    const refresh = useCallback(async () => {
        await Promise.all([fetchSummary(true), fetchData(true), fetchBindingApprovals()]);
    }, [fetchBindingApprovals, fetchData, fetchSummary]);

    const handleTabChange = useCallback((_event: SyntheticEvent, value: string) => {
        setActiveTab(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [setPagination]);

    const openTask = useCallback((row: MRT_Row<HumanTaskRow>) => {
        const context = buildWorkflowTaskContext(host || undefined, searchParams, row.original);
        navigate(buildWorkflowTaskRoute('/app/workflow/HumanTask', searchParams, context), {
            state: { source: location.pathname + location.search },
        });
    }, [host, location.pathname, location.search, navigate, searchParams]);

    const runTaskAction = useCallback(async (action: 'claimHumanTask' | 'releaseHumanTask', row: HumanTaskRow) => {
        if (!host) return;
        setActionLoading(`${action}:${row.taskAsstId}`);
        setError(null);

        try {
            if (action === 'claimHumanTask') {
                await workflowAdminClient.claimHumanTask(row.taskAsstId, row.assignmentVersion, 30);
            } else {
                await workflowAdminClient.releaseHumanTask(row.taskAsstId, row.assignmentVersion);
            }
            await refresh();
        } catch (e: any) {
            setError(e?.description || e?.message || 'Unable to update task claim.');
            await refresh();
        } finally {
            setActionLoading(null);
        }
    }, [host, refresh]);

    const columns = useMemo<MRT_ColumnDef<HumanTaskRow>[]>(
        () => [
            {
                accessorKey: 'assignmentStatus',
                header: 'Status',
                Cell: ({ row }) => statusChip(row.original.assignmentStatus, row.original.claimedBy),
            },
            {
                accessorFn: workflowLabel,
                id: 'workflowName',
                header: 'Workflow',
            },
            {
                accessorFn: (row) => row.ask?.prompt || row.wfTaskId || '',
                id: 'prompt',
                header: 'Task',
            },
            {
                accessorFn: (row) => row.assignmentLabel || row.assignmentId || row.assigneeId || '',
                id: 'assignmentTarget',
                header: 'Assignment',
            },
            { accessorKey: 'categoryCode', header: 'Category' },
            {
                accessorKey: 'claimExpiresTs',
                header: 'Claim Expires',
                Cell: ({ cell }) => formatDate(cell.getValue<string>()),
            },
            {
                accessorKey: 'deadlineTs',
                header: 'Due',
                Cell: ({ cell }) => formatDate(cell.getValue<string>()),
            },
            {
                accessorKey: 'assignedTs',
                header: 'Assigned',
                Cell: ({ cell }) => formatDate(cell.getValue<string>()),
            },
        ],
        [],
    );

    const table = useMaterialReactTable(usePortalActionTableOptions({
        columns,
        data,
        initialState: { density: 'compact' },
        manualPagination: true,
        rowCount,
        state: { isLoading, showProgressBars: isRefetching, pagination },
        onPaginationChange: setPagination,
        muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
        getRowId: (row) => row.taskAsstId,
        enableRowActions: true,
        positionActionsColumn: 'first',
        muiToolbarAlertBannerProps: error ? { color: 'error', children: error } : undefined,
        renderRowActions: ({ row }) => {
            const task = row.original;
            const canClaim = Boolean(task.canClaim);
            const canRelease = Boolean(task.canRelease);
            const claimLoading = actionLoading === `claimHumanTask:${task.taskAsstId}`;
            const releaseLoading = actionLoading === `releaseHumanTask:${task.taskAsstId}`;

          return <PortalActions row={row} actions={[
            {
              id: "open-task",
              label: "Open Task",
              description: "Open the task workspace.",
              icon: <PlayCircleOutlineIcon />,
              onSelect: () => openTask(row)
            },
            {
              id: "claim-task",
              label: "Claim Task",
              description: "Assign this task to yourself.",
              icon: <LockIcon />,
              disabledReason: () => (!canClaim || claimLoading) ? ('This task is not available to claim.') : null,
              loading: () => Boolean(claimLoading),
              onSelect: () => runTaskAction('claimHumanTask', task)
            },
            {
              id: "release-task",
              label: "Release Task",
              description: "Return this task to the available work queue.",
              icon: <LockOpenIcon />,
              disabledReason: () => (!canRelease || releaseLoading) ? ('This task is not available to release.') : null,
              loading: () => Boolean(releaseLoading),
              onSelect: () => runTaskAction('releaseHumanTask', task)
            }
          ]} />;
        },
        renderTopToolbarCustomActions: () => (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Button startIcon={<RefreshIcon />} onClick={refresh}>
                    Refresh
                </Button>
                <FormControlLabel
                    control={
                        <Switch
                            checked={showLocked}
                            onChange={(event) => {
                                setShowLocked(event.target.checked);
                                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                            }}
                        />
                    }
                    label="Show locked"
                />
            </Stack>
        ),
    }));

    return (
        <WorkflowTaskLayout context={taskContext}>
            <Stack spacing={2}>
                <Box sx={{border: 1, borderColor: 'divider', borderRadius: 1, p: 2}}>
                    <Typography variant="h6">Tool binding approvals ({bindingApprovals.length})</Typography>
                    {bindingError && <Alert severity="error">{bindingError}</Alert>}
                    {!bindingLoading && !bindingApprovals.length && !bindingError &&
                        <Typography>No pending Tool binding approvals.</Typography>}
                    {bindingApprovals.map(item => <Stack key={item.bindingId} direction="row" spacing={1}
                        alignItems="center" justifyContent="space-between">
                        <Typography>{item.toolName} · {item.workflowVersion} · {item.requestedBy}</Typography>
                        <Button onClick={() => navigate(`/app/workflow/tool-bindings/review/${encodeURIComponent(item.bindingId)}`)}>
                            Review revision</Button>
                    </Stack>)}
                </Box>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={tabs.some((tab) => tab.id === activeTab) ? activeTab : false}
                        onChange={handleTabChange}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                    >
                        {tabs.map((tab) => (
                            <Tab key={tab.id} value={tab.id} label={`${tab.label} (${tab.count})`} />
                        ))}
                    </Tabs>
                </Box>
          <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
            </Stack>
        </WorkflowTaskLayout>
    );
}
