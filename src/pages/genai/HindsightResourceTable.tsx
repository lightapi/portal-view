import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_Row,
    type MRT_SortingState,
} from 'material-react-table';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { buildGenAiTaskRoute } from './genAiTaskUtils';
import {
    compactContent,
    hindsightErrorMessage,
    optimisticRemove,
    runHindsightCommand,
    runHindsightQuery,
    type HindsightRow,
} from './hindsightMemoryApi';

export type HindsightColumn = {
    key: string;
    label: string;
    content?: boolean;
    json?: boolean;
    dateTime?: boolean;
    filterable?: boolean;
    sortable?: boolean;
};

export type HindsightResourceConfig = {
    label: string;
    listAction: string;
    collectionKey: string;
    rowKeys: string[];
    columns: HindsightColumn[];
    freshAction?: string;
    createForm?: string;
    updateForm?: string;
    deleteAction?: string;
    association?: boolean;
    readOnly?: boolean;
    sessionProjection?: boolean;
    formFields?: string[];
    readOnlyMessage?: string;
};

type Props = {
    hostId: string;
    bankId?: string;
    agentDefId?: string;
    config: HindsightResourceConfig;
    searchParams: URLSearchParams;
    taskContext: Record<string, unknown>;
    createDefaults?: Record<string, unknown>;
    bankReadOnly?: boolean;
};

function rowKey(row: HindsightRow, keys: string[]) {
    return keys.map(key => String(row[key] ?? '')).join('|');
}

function keyData(row: HindsightRow, keys: string[]) {
    return keys.reduce<Record<string, unknown>>((result, key) => {
        result[key] = row[key];
        return result;
    }, {});
}

function ContentCell({ value, label }: { value: unknown; label: string }) {
    const [open, setOpen] = useState(false);
    const full = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return (
        <>
            <Button
                size="small"
                color="inherit"
                disabled={!full}
                onClick={() => setOpen(true)}
                sx={{ textTransform: 'none', justifyContent: 'flex-start', maxWidth: 360 }}
            >
                {compactContent(full) || '—'}
            </Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>{label}</DialogTitle>
                <DialogContent>
                    <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {full}
                    </Typography>
                </DialogContent>
                <DialogActions><Button onClick={() => setOpen(false)}>Close</Button></DialogActions>
            </Dialog>
        </>
    );
}

export default function HindsightResourceTable({
    hostId, bankId, agentDefId, config, searchParams, taskContext, createDefaults = {}, bankReadOnly = false,
}: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const [rows, setRows] = useState<HindsightRow[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [pagination, setPagination] = usePersistentPagination();
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
        config.association ? [] : [{ id: 'active', value: 'true' }],
    );
    const [globalFilter, setGlobalFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [refetching, setRefetching] = useState(false);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [sessionDetail, setSessionDetail] = useState<HindsightRow | null>(null);
    const loaded = useRef(false);

    const fetchRows = useCallback(async () => {
        if (!hostId || (!bankId && !agentDefId)) return;
        loaded.current ? setRefetching(true) : setLoading(true);
        setMessage('');
        const filters: Array<{ id: string; value: unknown }> = [];
        let active = true;
        columnFilters.forEach(filter => {
            if (filter.id === 'active') active = filter.value === true || filter.value === 'true';
            else filters.push({ id: filter.id, value: filter.value });
        });
        const data: Record<string, unknown> = {
            hostId,
            ...(bankId ? { bankId } : {}),
            ...(agentDefId ? { agentDefId } : {}),
            offset: pagination.pageIndex * pagination.pageSize,
            limit: pagination.pageSize,
            filters,
            globalFilter: globalFilter || '',
            sorting,
        };
        if (!config.association) data.active = active;
        try {
            const response = await runHindsightQuery<Record<string, any>>(config.listAction, data);
            setRows(Array.isArray(response?.[config.collectionKey]) ? response[config.collectionKey] : []);
            setRowCount(Number(response?.total ?? 0));
            loaded.current = true;
        } catch (error) {
            setMessage(hindsightErrorMessage(error));
        } finally {
            setLoading(false);
            setRefetching(false);
        }
    }, [agentDefId, bankId, columnFilters, config.association, config.collectionKey, config.listAction,
        globalFilter, hostId, pagination.pageIndex, pagination.pageSize, sorting]);

    useEffect(() => { void fetchRows(); }, [fetchRows]);

    const navigateToForm = useCallback((formId: string, data: Record<string, unknown>) => {
        const context = {
            ...taskContext,
            ...keyData(data as HindsightRow, config.rowKeys),
            ...(bankId ? { bankId } : {}),
            ...(agentDefId ? { agentDefId } : {}),
        };
        const formData = config.formFields
            ? config.formFields.reduce<Record<string, unknown>>((result, field) => {
                if (Object.prototype.hasOwnProperty.call(data, field)) result[field] = data[field];
                return result;
            }, {})
            : data;
        navigate(buildGenAiTaskRoute(`/app/form/${formId}`, searchParams, context), {
            state: { data: formData, source: location.pathname + location.search },
        });
    }, [agentDefId, bankId, config.formFields, config.rowKeys, location.pathname, location.search,
        navigate, searchParams, taskContext]);

    const handleCreate = useCallback(() => {
        if (!config.createForm) return;
        navigateToForm(config.createForm, {
            ...createDefaults,
            hostId,
            ...(bankId ? { bankId } : {}),
            ...(agentDefId ? { agentDefId } : {}),
        });
    }, [agentDefId, bankId, config.createForm, createDefaults, hostId, navigateToForm]);

    const handleUpdate = useCallback(async (row: MRT_Row<HindsightRow>) => {
        if (!config.updateForm || !config.freshAction) return;
        const key = rowKey(row.original, config.rowKeys);
        setBusyKey(key);
        setMessage('');
        try {
            const fresh = await runHindsightQuery<HindsightRow>(config.freshAction, {
                ...keyData(row.original, config.rowKeys),
                aggregateVersion: row.original.aggregateVersion,
            });
            navigateToForm(config.updateForm, fresh);
        } catch (error) {
            setMessage(hindsightErrorMessage(error));
        } finally {
            setBusyKey(null);
        }
    }, [config.freshAction, config.rowKeys, config.updateForm, navigateToForm]);

    const handleDelete = useCallback(async (row: MRT_Row<HindsightRow>) => {
        if (!config.deleteAction) return;
        const key = rowKey(row.original, config.rowKeys);
        if (!window.confirm(`Remove this ${config.label.toLowerCase()} record?`)) return;
        setBusyKey(key);
        setMessage('');
        const commandData = {
            ...keyData(row.original, config.rowKeys),
            ...(config.association ? {} : { aggregateVersion: row.original.aggregateVersion }),
        };

        if (config.association) {
            try {
                await runHindsightCommand(config.deleteAction, commandData);
                await fetchRows();
            } catch (error) {
                setMessage(hindsightErrorMessage(error));
            } finally {
                setBusyKey(null);
            }
            return;
        }

        const optimistic = optimisticRemove(rows, rowCount,
            candidate => rowKey(candidate, config.rowKeys) === key);
        setRows(optimistic.nextRows);
        setRowCount(optimistic.nextRowCount);
        try {
            await runHindsightCommand(config.deleteAction, commandData);
        } catch (error) {
            setRows(optimistic.rollback.rows);
            setRowCount(optimistic.rollback.rowCount);
            setMessage(hindsightErrorMessage(error));
        } finally {
            setBusyKey(null);
        }
    }, [config.association, config.deleteAction, config.label, config.rowKeys, fetchRows, rowCount, rows]);

    const handleSessionDetail = useCallback(async (row: MRT_Row<HindsightRow>) => {
        const key = rowKey(row.original, config.rowKeys);
        setBusyKey(key);
        setMessage('');
        try {
            const detail = await runHindsightQuery<HindsightRow>('getAgentSessionHistoryProjection',
                keyData(row.original, config.rowKeys));
            setSessionDetail(detail);
        } catch (error) {
            setMessage(hindsightErrorMessage(error));
        } finally {
            setBusyKey(null);
        }
    }, [config.rowKeys]);

    const columns = useMemo<MRT_ColumnDef<HindsightRow>[]>(() => {
        const result = config.columns.map(column => ({
            accessorKey: column.key,
            header: column.label,
            enableColumnFilter: column.filterable === true,
            enableSorting: column.sortable === true,
            Cell: column.content || column.json
                ? ({ cell }: any) => <ContentCell value={cell.getValue()} label={column.label} />
                : column.dateTime
                    ? ({ cell }: any) => cell.getValue() ? new Date(cell.getValue()).toLocaleString() : '—'
                    : undefined,
        }));
        if (!config.association) {
            result.push({
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                enableColumnFilter: true,
                enableSorting: false,
                filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
                Cell: ({ cell }: any) => cell.getValue() ? 'True' : 'False',
            } as any);
        }
        return result;
    }, [config.association, config.columns]);

    const hasRowActions = !!(config.sessionProjection || (!bankReadOnly && (config.updateForm || config.deleteAction)));
    const table = useMaterialReactTable(usePortalActionTableOptions({
        columns,
        data: rows,
        initialState: { density: 'compact', showColumnFilters: true },
        manualFiltering: true,
        manualPagination: true,
        manualSorting: true,
        rowCount,
        getRowId: row => rowKey(row, config.rowKeys),
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
        onSortingChange: setSorting,
        state: {
            columnFilters,
            globalFilter,
            isLoading: loading,
            pagination,
            showAlertBanner: !!message,
            showProgressBars: refetching,
            sorting,
        },
        muiToolbarAlertBannerProps: message ? { color: 'error', children: message } : undefined,
        enableRowActions: hasRowActions,
        positionActionsColumn: 'first',
        renderRowActions: hasRowActions ? ({ row }) => {
            const key = rowKey(row.original, config.rowKeys);
          return <PortalActions row={row} actions={[
            {
              id: "view-projection",
              label: "View projection",
              icon: <VisibilityIcon />,
              hidden: () => !((config.sessionProjection)),

              loading: () => Boolean(busyKey === key),
              onSelect: () => void handleSessionDetail(row)
            },
            {
              id: "update-resource",
              label: `Update ${config.label}`,
              icon: <EditIcon />,
              hidden: () => !((!bankReadOnly && config.updateForm)),

              loading: () => Boolean(busyKey === key),
              onSelect: () => void handleUpdate(row)
            },
            {
              id: "unlink-association",
              label: config.association ? 'Unlink association' : `Deactivate ${config.label}`,
              icon: <DeleteForeverIcon />,
              destructive: true,
              hidden: () => !((!bankReadOnly && config.deleteAction)),

              loading: () => Boolean(busyKey === key),
              onSelect: () => void handleDelete(row)
            }
          ]} />;
        } : undefined,
        renderTopToolbarCustomActions: config.createForm && !bankReadOnly ? () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={handleCreate}>
                {config.association ? 'Link Unit and Entity' : `Create ${config.label}`}
            </Button>
        ) : undefined,
    }));

    return (
        <Box>
            {bankReadOnly && (
                <Alert severity="info" sx={{ mb: 1 }}>
                    Runtime-managed banks and their resources are read-only in Portal.
                </Alert>
            )}
            {config.readOnly && (
                <Alert severity="info" sx={{ mb: 1 }}>
                    {config.readOnlyMessage || (config.sessionProjection
                        ? 'Session history is a runtime-owned projection and is read-only in Portal.'
                        : `${config.label} content is read-only until an embedding owner is available.`)}
                </Alert>
            )}
        <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
            <Dialog open={!!sessionDetail} onClose={() => setSessionDetail(null)} maxWidth="lg" fullWidth>
                <DialogTitle>Session Projection</DialogTitle>
                <DialogContent>
                    {sessionDetail && (
                        <Stack spacing={2}>
                            <Alert severity={sessionDetail.projectionState === 'CURRENT' ? 'success' : 'warning'}>
                                Projection state: {sessionDetail.projectionState || 'unknown'} · sequence {sessionDetail.projectionSequence ?? 0}
                            </Alert>
                            <ContentCell value={sessionDetail.messages} label="Messages" />
                            <ContentCell value={sessionDetail.metadata} label="Metadata" />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions><Button onClick={() => setSessionDetail(null)}>Close</Button></DialogActions>
            </Dialog>
        </Box>
    );
}
