import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_SortingState,
    type MRT_Row,
} from 'material-react-table';
import { Button, IconButton, Tooltip, CircularProgress, Box } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type AuditLogApiResponse = {
    auditLogs: Array<AuditLogType>;
    total: number;
};

type AuditLogType = {
    hostId: string;
    auditLogId: string;
    sourceTypeId?: string;
    correlationId?: string;
    userId?: string;
    eventTs: string;
    success?: string;
    message0?: string;
    message1?: string;
    message2?: string;
    message3?: string;
    message?: string;
    userComment?: string;
};

interface UserState {
    host?: string;
}

export default function AuditLog() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;

    // Data and fetching state
    const [data, setData] = useState<AuditLogType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([
        { id: 'eventTs', desc: true }
    ]);
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    // Data fetching logic
    const fetchData = useCallback(async () => {
        if (!host) return;
        if (!data.length) setIsLoading(true); else setIsRefetching(true);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getAuditLog', version: '0.1.0',
            data: {
                hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(columnFilters ?? []),
                globalFilter: globalFilter ?? '',
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        try {
            const json = await fetchClient(url);
            setData(json.auditLogs || []);
            setRowCount(json.total || 0);
        } catch (error) {
            setIsError(true); console.error(error);
        } finally {
            setIsError(false); setIsLoading(false); setIsRefetching(false);
        }
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

    // useEffect to trigger fetchData
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<AuditLogType>) => {
        if (!window.confirm(`Are you sure you want to delete audit log: ${row.original.auditLogId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => d.auditLogId !== row.original.auditLogId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'deleteAuditLog', version: '0.1.0',
            data: { hostId: row.original.hostId, auditLogId: row.original.auditLogId },
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete audit log. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete audit log due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<AuditLogType>) => {
        const auditLogId = row.original.auditLogId;
        setIsUpdateLoading(auditLogId);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshAuditLog', version: '0.1.0',
            data: { hostId: row.original.hostId, auditLogId: row.original.auditLogId },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);

            // Navigate with the fresh data
            navigate('/app/form/updateAuditLog', {
                state: {
                    data: freshData,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch audit log for update:", error);
            alert("Could not load the latest audit log data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<AuditLogType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'auditLogId', header: 'Audit Log Id' },
            { accessorKey: 'sourceTypeId', header: 'Source Type Id' },
            { accessorKey: 'correlationId', header: 'Correlation Id' },
            { accessorKey: 'userId', header: 'User Id' },
            {
                accessorKey: 'eventTs',
                header: 'Event Time',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            { accessorKey: 'success', header: 'Success' },
            { accessorKey: 'message0', header: 'Message 0' },
            { accessorKey: 'message1', header: 'Message 1' },
            { accessorKey: 'message2', header: 'Message 2' },
            { accessorKey: 'message3', header: 'Message 3' },
            { accessorKey: 'message', header: 'Message' },
            { accessorKey: 'userComment', header: 'User Comment' },
            { accessorKey: 'userComment', header: 'User Comment' },
        ],
        [handleDelete, handleUpdate, navigate],
    );

    // Table instance configuration
    const table = useMaterialReactTable({
        columns,
        data,
        initialState: { showColumnFilters: true, density: 'compact' },
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        rowCount,
        state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getRowId: (row) => row.auditLogId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        renderRowActions: ({ row }) => (
            <Box sx={{ display: 'flex', gap: '0.1rem' }}>
                <Tooltip title="Update Audit Log">
                    <IconButton
                        onClick={() => handleUpdate(row)}
                        disabled={isUpdateLoading === row.original.auditLogId}
                    >
                        {isUpdateLoading === row.original.auditLogId ? (
                            <CircularProgress size={22} />
                        ) : (
                            <SystemUpdateIcon />
                        )}
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete Audit Log">
                    <IconButton color="error" onClick={() => handleDelete(row)}>
                        <DeleteForeverIcon />
                    </IconButton>
                </Tooltip>
            </Box>
        ),
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createAuditLog')}>
                Create New Audit Log
            </Button>
        ),
    });

    return <MaterialReactTable table={table} />;
}
