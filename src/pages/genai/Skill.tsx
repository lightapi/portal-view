import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_SortingState,
    type MRT_Row,
} from 'material-react-table';
import { Button } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import HubIcon from '@mui/icons-material/Hub';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import { buildGenAiTaskContext, buildGenAiTaskRoute, GenAiTaskLayout } from './genAiTaskUtils';

// --- Type Definitions ---
type SkillApiResponse = {
    skills: Array<SkillType>;
    total: number;
};

type SkillType = {
    hostId: string;
    skillId: string;
    parentSkillId?: string;
    name: string;
    description?: string;
    contentMarkdown: string;
    version?: string;
    tagIds?: string[];
    categoryIds?: string[];
    tags?: string[];
    categories?: string[];
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

export default function Skill() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskContext = useMemo(() => buildGenAiTaskContext(host, searchParams), [host, searchParams]);
    const contextForRow = useCallback(
        (row: SkillType) => buildGenAiTaskContext(host, searchParams, row),
        [host, searchParams],
    );

    // Data and fetching state
    const [data, setData] = useState<SkillType[]>([]);
    const [isError, setIsError] = useState<string | false>(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
        { id: 'active', value: 'true' }
    ]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [pagination, setPagination] = usePersistentPagination();

    // Data fetching logic
    const fetchData = useCallback(async () => {
        if (!host) return;
        setIsError(false);
        if (!data.length) setIsLoading(true); else setIsRefetching(true);

        let activeStatus = true; // Default to true if not present
        const apiFilters: MRT_ColumnFiltersState = [];

        columnFilters.forEach(filter => {
            if (filter.id === 'active') {
                activeStatus = filter.value === 'true' || filter.value === true;
            } else {
                apiFilters.push(filter);
            }
        });

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getSkill', version: '0.1.0',
            data: {
                hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(apiFilters ?? []),
                globalFilter: globalFilter ?? '',
                active: activeStatus,
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        try {
            const json = await fetchClient(url);
            setData(json.skills || []);
            setRowCount(json.total || 0);
        } catch (error) {
            setIsError(loadErrorMessage(error)); console.error(error);
        } finally {
            setIsLoading(false); setIsRefetching(false);
        }
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

    // useEffect to trigger fetchData
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<SkillType>) => {
        if (!window.confirm(`Are you sure you want to delete skill: ${row.original.skillId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => d.skillId !== row.original.skillId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'deleteSkill', version: '0.1.0',
      data: { hostId: row.original.hostId, skillId: row.original.skillId , aggregateVersion: row.original.aggregateVersion},
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete skill. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete skill due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<SkillType>) => {
        const skillId = row.original.skillId;
        setIsUpdateLoading(skillId);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshSkill', version: '0.1.0',
      data: { hostId: row.original.hostId, aggregateVersion: row.original.aggregateVersion, skillId: row.original.skillId },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

            // Navigate with the fresh data
            navigate(buildGenAiTaskRoute('/app/form/updateSkill', searchParams, contextForRow(row.original)), {
                state: {
                    data: dataForForm,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch skill for update:", error);
            alert("Could not load the latest skill data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname, searchParams, contextForRow]);

    const handleWorkspace = useCallback((row: MRT_Row<SkillType>) => {
        navigate(buildGenAiTaskRoute('/app/genai/SkillWorkspace', searchParams, contextForRow(row.original)), {
            state: {
                data: row.original,
                source: location.pathname
            }
        });
    }, [navigate, location.pathname, searchParams, contextForRow]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<SkillType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'skillId', header: 'Skill Id' },
            { accessorKey: 'parentSkillId', header: 'Parent Skill Id' },
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'description', header: 'Description' },
            { accessorKey: 'version', header: 'Version' },
            { accessorKey: 'updateUser', header: 'Update User' },
            {
                accessorKey: 'updateTs',
                header: 'Update Time',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            { accessorKey: 'aggregateVersion', header: 'AggregateVersion' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
            },
        ],
        [],
    );

    // Table instance configuration
    const table = useMaterialReactTable(usePortalActionTableOptions({
        columns,
        data,
        initialState: { showColumnFilters: true, density: 'compact' },
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        rowCount,
        state: { isLoading, showAlertBanner: Boolean(isError), showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
        onPaginationChange: setPagination,
        muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getRowId: (row) => row.skillId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading data' } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
      renderRowActions: ({ row }) => <PortalActions row={row} actions={[
        {
          id: "open-skill-workspace",
          label: "Open Skill Workspace",
          description: "Manage the skill tools and workflows.",
          icon: <HubIcon />,
          onSelect: () => handleWorkspace(row)
        },
        {
          id: "update-skill",
          label: "Update Skill",
          icon: (
            <SystemUpdateIcon />
          ),

          loading: () => Boolean(isUpdateLoading === row.original.skillId),
          onSelect: () => handleUpdate(row)
        },
        {
          id: "delete-skill",
          label: "Delete Skill",
          icon: <DeleteForeverIcon />,
          destructive: true,
          onSelect: () => handleDelete(row)
        }
      ]} />,
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildGenAiTaskRoute('/app/form/createSkill', searchParams, taskContext))}>
                Create New Skill
            </Button>
        ),
    }));

    return (
        <GenAiTaskLayout context={taskContext}>
        <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
        </GenAiTaskLayout>
    );
}
