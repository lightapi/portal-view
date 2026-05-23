import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_PaginationState,
    type MRT_Row,
} from 'material-react-table';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';
import { buildWorkflowTaskContext, buildWorkflowTaskRoute, WorkflowTaskLayout } from './workflowTaskUtils';

type HumanTaskRow = {
    hostId: string;
    taskAsstId: string;
    taskId: string;
    processId?: string;
    wfInstanceId?: string;
    wfTaskId?: string;
    assignedTs?: string;
    assigneeId?: string;
    assignmentType?: string;
    assignmentId?: string;
    assignmentLabel?: string;
    assignmentStatusCode?: string;
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

function statusChip(status?: string) {
    const color = status === 'CLAIMED' ? 'warning' : status === 'ASSIGNED' ? 'success' : 'default';
    return <Chip size="small" color={color} label={status || ''} />;
}

export default function HumanTasks() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskContext = useMemo(() => buildWorkflowTaskContext(host || undefined, searchParams), [host, searchParams]);

    const [data, setData] = useState<HumanTaskRow[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    const fetchData = useCallback(async (background = false) => {
        if (!host) return;
        if (background) {
            setIsRefetching(true);
        } else {
            setIsLoading(true);
        }
        setError(null);
        const cmd = {
            host: 'lightapi.net',
            service: 'workflow',
            action: 'getHumanTaskList',
            version: '0.1.0',
            data: {
                hostId: host,
                offset: pagination.pageIndex * pagination.pageSize,
                limit: pagination.pageSize,
                includeClaimed: true,
            },
        };
        try {
            const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
            setData(json.humanTasks || []);
            setRowCount(json.total || 0);
        } catch (e: any) {
            setError(e?.description || e?.message || 'Unable to load human tasks.');
        } finally {
            setIsLoading(false);
            setIsRefetching(false);
        }
    }, [host, pagination.pageIndex, pagination.pageSize]);

    useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    useEffect(() => {
        const id = window.setInterval(() => fetchData(true), 15000);
        return () => window.clearInterval(id);
    }, [fetchData]);

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
        const cmd = {
            host: 'lightapi.net',
            service: 'workflow',
            action,
            version: '0.1.0',
            data: {
                hostId: host,
                taskAsstId: row.taskAsstId,
                ...(action === 'claimHumanTask' ? { claimMinutes: 30 } : {}),
            },
        };
        try {
            await fetchClient('/portal/command', { method: 'POST', body: cmd });
            await fetchData(true);
        } catch (e: any) {
            setError(e?.description || e?.message || 'Unable to update task claim.');
            await fetchData(true);
        } finally {
            setActionLoading(null);
        }
    }, [fetchData, host]);

    const columns = useMemo<MRT_ColumnDef<HumanTaskRow>[]>(
        () => [
            {
                accessorKey: 'assignmentStatusCode',
                header: 'Status',
                Cell: ({ row }) => statusChip(row.original.assignmentStatusCode),
            },
            {
                accessorFn: (row) => row.workflow?.name || row.wfTaskId || row.taskId,
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
            { accessorKey: 'claimedBy', header: 'Claimed By' },
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

    const table = useMaterialReactTable({
        columns,
        data,
        initialState: { density: 'compact' },
        manualPagination: true,
        rowCount,
        state: { isLoading, showProgressBars: isRefetching, pagination },
        onPaginationChange: setPagination,
        getRowId: (row) => row.taskAsstId,
        enableRowActions: true,
        positionActionsColumn: 'first',
        muiToolbarAlertBannerProps: error ? { color: 'error', children: error } : undefined,
        renderRowActions: ({ row }) => {
            const task = row.original;
            const canClaim = Boolean(task.canClaim);
            const canRelease = Boolean(task.canRelease);
            return (
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Open Task">
                        <IconButton color="primary" onClick={() => openTask(row)}>
                            <PlayCircleOutlineIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Claim Task">
                        <span>
                            <IconButton
                                color="primary"
                                disabled={!canClaim || actionLoading === `claimHumanTask:${task.taskAsstId}`}
                                onClick={() => runTaskAction('claimHumanTask', task)}
                            >
                                {actionLoading === `claimHumanTask:${task.taskAsstId}` ? <CircularProgress size={22} /> : <LockIcon />}
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Release Task">
                        <span>
                            <IconButton
                                disabled={!canRelease || actionLoading === `releaseHumanTask:${task.taskAsstId}`}
                                onClick={() => runTaskAction('releaseHumanTask', task)}
                            >
                                {actionLoading === `releaseHumanTask:${task.taskAsstId}` ? <CircularProgress size={22} /> : <LockOpenIcon />}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            );
        },
        renderTopToolbarCustomActions: () => (
            <Stack direction="row" spacing={1}>
                <Button startIcon={<RefreshIcon />} onClick={() => fetchData(true)}>
                    Refresh
                </Button>
            </Stack>
        ),
    });

    return (
        <WorkflowTaskLayout context={taskContext}>
            <Stack spacing={2}>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <MaterialReactTable table={table} />
            </Stack>
        </WorkflowTaskLayout>
    );
}
