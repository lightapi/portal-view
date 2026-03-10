import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_SortingState,
    type MRT_RowSelectionState,
} from 'material-react-table';
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Typography,
    Paper,
    Stepper,
    Step,
    StepLabel,
    Alert,
    CircularProgress,
    Chip,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PreviewIcon from '@mui/icons-material/Preview';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type HostType = {
    hostId: string;
    domain: string;
    subDomain: string;
    hostDesc?: string;
};

type InstanceType = {
    hostId: string;
    instanceId: string;
    instanceName: string;
    productVersionId: string;
    serviceId: string;
    environment?: string;
    zone?: string;
    region?: string;
    lob?: string;
    envTag?: string;
    current?: boolean;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

type ConfigType = {
    configId: string;
    configName?: string;
    configPhase?: string;
    configType?: string;
    light4jVersion?: string;
    classPath?: string;
    configDesc?: string;
    updateUser?: string;
    updateTs?: string;
    aggregateVersion?: number;
    active: boolean;
};

const ENTITY_TYPES = [
    { value: 'instance', label: 'Instance' },
    { value: 'config', label: 'Config' },
    { value: 'ref_table', label: 'Ref Table' },
    { value: 'relation_type', label: 'Ref Relation' },
    { value: 'user', label: 'User' },
    { value: 'position', label: 'Position' },
    { value: 'role', label: 'Role' },
    { value: 'group', label: 'Group' },
    { value: 'attribute', label: 'Attribute' },
    { value: 'auth_provider', label: 'Auth Provider' },
    { value: 'auth_client', label: 'Auth Client' },
    { value: 'schedule', label: 'Schedule' },
    { value: 'tag', label: 'Tag' },
    { value: 'category', label: 'Category' },
];

const steps = ['Select Source & Type', 'Select Entities', 'Preview & Export'];

export default function PromotionExport() {
    const navigate = useNavigate();
    const { host: userContextHost } = useUserState() as UserState;

    // Stepper state
    const [activeStep, setActiveStep] = useState(0);

    // Step 1: Source selection
    const [sourceHostId, setSourceHostId] = useState(userContextHost || '');
    const [entityType, setEntityType] = useState('instance');
    const [hosts, setHosts] = useState<HostType[]>([]);
    const [isLoadingHosts, setIsLoadingHosts] = useState(false);

    // Step 2: Entity selection
    const [entities, setEntities] = useState<any[]>([]);
    const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
    const [isLoadingEntities, setIsLoadingEntities] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
        { id: 'active', value: 'true' },
    ]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    // Step 3: Export
    const [isExporting, setIsExporting] = useState(false);
    const [exportResult, setExportResult] = useState<object | null>(null);

    // Target host for same-instance promotion
    const [targetHostId, setTargetHostId] = useState('');

    // Load hosts on mount
    useEffect(() => {
        const loadHosts = async () => {
            setIsLoadingHosts(true);
            try {
                const cmd = {
                    host: 'lightapi.net', service: 'host', action: 'getHost', version: '0.1.0',
                    data: { offset: 0, limit: 100, active: true },
                };
                const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
                const json = await fetchClient(url) as { hosts: HostType[]; total: number };
                setHosts(json.hosts || []);
            } catch (error) {
                console.error('Failed to load hosts:', error);
            } finally {
                setIsLoadingHosts(false);
            }
        };
        loadHosts();
    }, []);

    // Load entities when step 2 is active
    const fetchEntities = useCallback(async () => {
        if (!sourceHostId || activeStep < 1) return;
        setIsLoadingEntities(true);

        const apiFilters: MRT_ColumnFiltersState = [];
        let activeStatus = true;
        columnFilters.forEach(filter => {
            if (filter.id === 'active') {
                activeStatus = filter.value === 'true' || filter.value === true;
            } else if (filter.id === 'current') {
                apiFilters.push({ ...filter, value: filter.value === 'true' });
            } else {
                apiFilters.push(filter);
            }
        });

        const cmd = {
            host: 'lightapi.net',
            service: entityType === 'ref_table' || entityType === 'relation_type' ? 'ref' : (entityType === 'user' || entityType === 'role' || entityType === 'group' || entityType === 'attribute') ? entityType : (entityType === 'auth_provider' || entityType === 'auth_client') ? 'oauth-query' : (entityType === 'schedule' || entityType === 'tag' || entityType === 'category') ? entityType : entityType,
            action: entityType === 'instance' ? 'getInstance' : entityType === 'config' ? 'getConfig' : entityType === 'ref_table' ? 'getRefTable' : entityType === 'user' ? 'listUserByHostId' : entityType === 'position' ? 'getPosition' : entityType === 'role' ? 'getRole' : entityType === 'group' ? 'getGroup' : entityType === 'attribute' ? 'getAttribute' : entityType === 'auth_provider' ? 'queryAuthProvider' : entityType === 'auth_client' ? 'queryAuthClient' : entityType === 'schedule' ? 'getSchedule' : entityType === 'tag' ? 'getTag' : entityType === 'category' ? 'getCategory' : 'getRefRelationType',
            version: '0.1.0',
            data: {
                hostId: sourceHostId,
                offset: pagination.pageIndex * pagination.pageSize,
                limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(apiFilters ?? []),
                globalFilter: globalFilter ?? '',
                active: activeStatus,
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const json = await fetchClient(url) as any;
            const dataKey = entityType === 'relation_type' ? 'relationType' : entityType === 'ref_table' ? 'refTable' : (entityType === 'user' || entityType === 'role' || entityType === 'group' || entityType === 'attribute' || entityType === 'tag' || entityType === 'category') ? entityType : entityType === 'auth_provider' ? 'authProvider' : entityType === 'auth_client' ? 'authClient' : entityType === 'schedule' ? 'schedule' : entityType;
            setEntities(json[`${dataKey}s`] || []);
            setRowCount(json.total || 0);
        } catch (error) {
            console.error('Failed to load entities:', error);
        } finally {
            setIsLoadingEntities(false);
        }
    }, [sourceHostId, activeStep, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, entityType]);

    useEffect(() => {
        if (activeStep >= 1) {
            fetchEntities();
        }
    }, [fetchEntities, activeStep]);

    // Export handler
    const handleExportJSON = useCallback(async () => {
        const selectedIds = Object.keys(rowSelection).filter(key => rowSelection[key]);
        if (selectedIds.length === 0) return;

        setIsExporting(true);
        try {
            const cmd = {
                host: 'lightapi.net', service: 'user', action: 'exportSnapshot', version: '0.1.0',
                data: {
                    sourceHostId,
                    entityType,
                    entityIds: selectedIds,
                    includeChildren: true,
                    includeSiblings: true,
                },
            };
            const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
            const json = await fetchClient(url);
            setExportResult(json);

            // Download as JSON file
            const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `promotion-export-${entityType}-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please check the console for details.');
        } finally {
            setIsExporting(false);
        }
    }, [rowSelection, sourceHostId, entityType]);

    // Promote to another host (same instance)
    const handlePromoteToHost = useCallback(async () => {
        const selectedIds = Object.keys(rowSelection).filter(key => rowSelection[key]);
        if (selectedIds.length === 0 || !targetHostId) return;

        setIsExporting(true);
        try {
            // First export the snapshot
            const exportCmd = {
                host: 'lightapi.net', service: 'user', action: 'exportSnapshot', version: '0.1.0',
                data: {
                    sourceHostId,
                    entityType,
                    entityIds: selectedIds,
                    includeChildren: true,
                    includeSiblings: true,
                },
            };
            const exportUrl = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(exportCmd));
            const snapshot = await fetchClient(exportUrl);

            // Navigate to import page with the snapshot and target host
            navigate('/app/promotion/import', {
                state: {
                    snapshot,
                    targetHostId,
                    fromExport: true,
                },
            });
        } catch (error) {
            console.error('Promotion setup failed:', error);
            alert('Failed to prepare promotion. Please check the console for details.');
        } finally {
            setIsExporting(false);
        }
    }, [rowSelection, sourceHostId, entityType, targetHostId, navigate]);

    // Instance table columns
    const instanceColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'instanceName', header: 'Instance Name' },
            { accessorKey: 'serviceId', header: 'Service ID' },
            { accessorKey: 'environment', header: 'Environment' },
            { accessorKey: 'zone', header: 'Zone' },
            { accessorKey: 'region', header: 'Region' },
            { accessorKey: 'envTag', header: 'Env Tag' },
            {
                accessorKey: 'current',
                header: 'Current',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const configColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'configName', header: 'Name' },
            { accessorKey: 'configPhase', header: 'Phase' },
            { accessorKey: 'configType', header: 'Type' },
            { accessorKey: 'light4jVersion', header: 'Light4j Version' },
            { accessorKey: 'classPath', header: 'Class Path' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
            },
        ],
        [],
    );

    const refTableColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'tableName', header: 'Table Name' },
            { accessorKey: 'tableDesc', header: 'Description' },
            {
                accessorKey: 'editable',
                header: 'Editable',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const refRelationTypeColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'relationId', header: 'Relation ID' },
            { accessorKey: 'relationName', header: 'Relation Type' },
            { accessorKey: 'relationDesc', header: 'Description' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const userColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'email', header: 'Email' },
            { accessorKey: 'firstName', header: 'First Name' },
            { accessorKey: 'lastName', header: 'Last Name' },
            { accessorKey: 'userType', header: 'User Type' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const positionColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'positionId', header: 'Position ID' },
            { accessorKey: 'positionDesc', header: 'Description' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const roleColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'roleId', header: 'Role ID' },
            { accessorKey: 'roleDesc', header: 'Description' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const groupColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'groupId', header: 'Group ID' },
            { accessorKey: 'groupDesc', header: 'Description' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const attributeColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'attributeId', header: 'Attribute ID' },
            { accessorKey: 'attributeType', header: 'Type' },
            { accessorKey: 'attributeDesc', header: 'Description' },
            { accessorKey: 'attributeValue', header: 'Value' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const authProviderColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'providerId', header: 'Provider ID' },
            { accessorKey: 'providerDesc', header: 'Description' },
            { accessorKey: 'serverUrl', header: 'Server URL' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const authClientColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'clientId', header: 'Client ID' },
            { accessorKey: 'clientName', header: 'Name' },
            { accessorKey: 'clientDesc', header: 'Description' },
            { accessorKey: 'clientType', header: 'Type' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const scheduleColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'scheduleId', header: 'Schedule ID' },
            { accessorKey: 'scheduleDesc', header: 'Description' },
            { accessorKey: 'scheduleType', header: 'Type' },
            { accessorKey: 'cronExpression', header: 'Cron' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const tagColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'tagId', header: 'Tag ID' },
            { accessorKey: 'tagName', header: 'Tag Name' },
            { accessorKey: 'entityType', header: 'Entity Type' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const categoryColumns = useMemo<MRT_ColumnDef<any>[]>(
        () => [
            { accessorKey: 'categoryId', header: 'Category ID' },
            { accessorKey: 'categoryName', header: 'Category Name' },
            { accessorKey: 'entityType', header: 'Entity Type' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
            },
        ],
        [],
    );

    const columns = entityType === 'config' ? configColumns : entityType === 'ref_table' ? refTableColumns : entityType === 'relation_type' ? refRelationTypeColumns : entityType === 'user' ? userColumns : entityType === 'position' ? positionColumns : entityType === 'role' ? roleColumns : entityType === 'group' ? groupColumns : entityType === 'attribute' ? attributeColumns : entityType === 'auth_provider' ? authProviderColumns : entityType === 'auth_client' ? authClientColumns : entityType === 'schedule' ? scheduleColumns : entityType === 'tag' ? tagColumns : entityType === 'category' ? categoryColumns : instanceColumns;


    const table = useMaterialReactTable({
        columns,
        data: entities,
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        state: {
            rowSelection,
            isLoading: isLoadingEntities,
            pagination,
            sorting,
            columnFilters,
            globalFilter,
        },
        initialState: { showColumnFilters: true, density: 'compact' },
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        rowCount,
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getRowId: (row) =>
            row.instanceId ||
            row.configId ||
            row.tableId ||
            row.relationId ||
            row.email ||
            row.positionId ||
            row.roleId ||
            row.groupId ||
            row.attributeId ||
            row.providerId ||
            row.clientId ||
            row.scheduleId ||
            row.tagId ||
            row.categoryId,
    });

    const selectedCount = Object.keys(rowSelection).filter(k => rowSelection[k]).length;

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                Export Entities for Promotion
            </Typography>

            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {/* Step 1: Source Selection */}
            {activeStep === 0 && (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Select Source & Entity Type</Typography>
                    <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                        <FormControl sx={{ minWidth: 300 }}>
                            <InputLabel>Source Host</InputLabel>
                            <Select
                                value={sourceHostId}
                                label="Source Host"
                                onChange={(e) => setSourceHostId(e.target.value)}
                                disabled={isLoadingHosts}
                            >
                                {hosts.map((h) => (
                                    <MenuItem key={h.hostId} value={h.hostId}>
                                        {h.domain} / {h.subDomain}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl sx={{ minWidth: 200 }}>
                            <InputLabel>Entity Type</InputLabel>
                            <Select
                                value={entityType}
                                label="Entity Type"
                                onChange={(e) => setEntityType(e.target.value)}
                            >
                                {ENTITY_TYPES.map((et) => (
                                    <MenuItem key={et.value} value={et.value}>{et.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="contained"
                            onClick={() => setActiveStep(1)}
                            disabled={!sourceHostId}
                        >
                            Next: Select Entities
                        </Button>
                    </Box>
                </Paper>
            )}

            {/* Step 2: Entity Selection */}
            {activeStep === 1 && (
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Button variant="outlined" onClick={() => setActiveStep(0)}>Back</Button>
                        <Typography variant="subtitle1">
                            Source: <strong>{hosts.find(h => h.hostId === sourceHostId)?.domain}/{hosts.find(h => h.hostId === sourceHostId)?.subDomain}</strong>
                        </Typography>
                        <Chip label={`Entity Type: ${entityType}`} color="primary" />
                        {selectedCount > 0 && (
                            <Chip label={`${selectedCount} selected`} color="success" />
                        )}
                    </Box>

                    <MaterialReactTable table={table} />

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="contained"
                            onClick={() => setActiveStep(2)}
                            disabled={selectedCount === 0}
                        >
                            Next: Preview & Export
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Step 3: Preview & Export */}
            {activeStep === 2 && (
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <Button variant="outlined" onClick={() => setActiveStep(1)}>Back</Button>
                        <Typography variant="h6">Export Options</Typography>
                    </Box>

                    <Alert severity="info" sx={{ mb: 3 }}>
                        <strong>{selectedCount}</strong> {entityType}(s) selected for export from{' '}
                        <strong>{hosts.find(h => h.hostId === sourceHostId)?.domain}/{hosts.find(h => h.hostId === sourceHostId)?.subDomain}</strong>.
                        All child entities (properties, files, APIs, apps) will be included automatically.
                    </Alert>

                    {/* Option 1: Download JSON */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Option 1: Download as JSON (Cross-Instance)
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Export the selected entities as a JSON file. Use this to import into a different environment or database instance.
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={isExporting ? <CircularProgress size={20} /> : <FileDownloadIcon />}
                            onClick={handleExportJSON}
                            disabled={isExporting}
                        >
                            Download JSON Package
                        </Button>
                    </Paper>

                    {/* Option 2: Promote to Host */}
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Option 2: Promote to Host (Same Instance)
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Promote entities directly to another host within the same database. This will perform a dry run first.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                            <FormControl sx={{ minWidth: 300 }}>
                                <InputLabel>Target Host</InputLabel>
                                <Select
                                    value={targetHostId}
                                    label="Target Host"
                                    onChange={(e) => setTargetHostId(e.target.value)}
                                >
                                    {hosts
                                        .filter((h) => h.hostId !== sourceHostId)
                                        .map((h) => (
                                            <MenuItem key={h.hostId} value={h.hostId}>
                                                {h.domain} / {h.subDomain}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={isExporting ? <CircularProgress size={20} /> : <CompareArrowsIcon />}
                                onClick={handlePromoteToHost}
                                disabled={!targetHostId || isExporting}
                            >
                                Promote & Preview Diff
                            </Button>
                        </Box>
                    </Paper>

                    {exportResult && (
                        <Alert severity="success" sx={{ mt: 3 }}>
                            Export completed successfully! The JSON file has been downloaded.
                        </Alert>
                    )}
                </Paper>
            )}
        </Box>
    );
}
