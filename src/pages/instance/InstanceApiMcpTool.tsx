import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from "react-router-dom";
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_RowSelectionState,
} from 'material-react-table';
import { Box, Button, Typography, Alert, Snackbar } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import { useUserState } from "../../contexts/UserContext";
import fetchClient from "../../utils/fetchClient";
import { Tooltip } from '@mui/material';

type McpToolType = {
    name: string;
    endpointId: string;
    endpoint: string;
    method?: string;
    path?: string;
    description: string;
    inputSchema?: string;
    toolMetadata?: string;
    selected: boolean;
};

interface UserState {
    host?: string;
}

function toKebabCase(str: string): string {
    if (!str) return '';
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

export default function InstanceApiMcpTool() {
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const initialData = location.state?.data || {};
    const { instanceApiId, apiVersion, apiId, instanceName, apiVersionId, serviceId, apiName, apiType, protocol, envTag, targetHost, productId } = initialData;

    const [data, setData] = useState<McpToolType[]>([]);
    const [metadata, setMetadata] = useState<{
        propertyId: string | null;
        configId: string | null;
        aggregateVersion: number;
        exists: boolean;
    }>({ propertyId: null, configId: null, aggregateVersion: 0, exists: false });
    const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const fetchData = useCallback(async () => {
        if (!host || !instanceApiId || !apiVersionId) return;
        setIsLoading(true);
        setIsError(false);

        const cmd = {
            host: 'lightapi.net', service: 'instance', action: 'getInstanceApiMcpTool', version: '0.1.0',
            data: {
                hostId: host,
                instanceApiId,
                apiVersionId,
            },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const json = await fetchClient(url);
            const fetchedData: any[] = json?.endpoints || [];

            // Standardize the data from backend
            const standardizedData: McpToolType[] = fetchedData.map(t => {
                const baseName = t.endpointName || t.name || '';
                const safeProductId = productId || '';
                const safeApiIdentifier = apiName || apiId || '';
                
                let enhancedName = t.name || '';
                const needsPrefix = (safeProductId && !enhancedName.includes(safeProductId)) || 
                                   (safeApiIdentifier && !enhancedName.includes(safeApiIdentifier));
                
                if (!enhancedName || needsPrefix) {
                    enhancedName = toKebabCase(`${safeProductId}-${safeApiIdentifier}-${baseName}`);
                } else {
                    // Even if already prefixed, ensure it's in kebab-case
                    enhancedName = toKebabCase(enhancedName);
                }
                
                // Final cleanup of hyphens
                enhancedName = enhancedName.replace(/-+/g, '-').replace(/^-|-$/g, '');
                
                return {
                    ...t,
                    name: enhancedName,
                    description: t.description || t.endpointDesc || '',
                    path: t.path || t.endpointPath || '',
                    method: t.method || t.httpMethod || '',
                    inputSchema: t.inputSchema || t.toolSchema || '',
                };
            });

            console.log(standardizedData);
            setData(standardizedData);
            setMetadata({
                propertyId: json?.propertyId || null,
                configId: json?.configId || null,
                aggregateVersion: json?.aggregateVersion || 0,
                exists: json?.exists || false,
            });

            const initialSelection: MRT_RowSelectionState = {};
            standardizedData.forEach(row => {
                if (row.selected) {
                    initialSelection[row.endpointId] = true;
                }
            });
            setRowSelection(initialSelection);
        } catch (error) {
            setIsError(true);
            console.error(error);
            setErrorMsg('Failed to load MCP tools');
        } finally {
            setIsLoading(false);
        }
    }, [host, instanceApiId, apiVersionId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async () => {
        if (!host || !instanceApiId || !metadata.propertyId) return;

        const selectedToolsNames = Object.keys(rowSelection).filter(key => rowSelection[key]);
        const selectedTools = selectedToolsNames.map(endpointId => {
            const tool = data.find(t => t.endpointId === endpointId);
            let toolSchemaObj = null;
            let toolMetadataObj = null;
            try {
                if (tool?.inputSchema) toolSchemaObj = JSON.parse(tool.inputSchema);
            } catch (e) {
                console.error("Failed to parse toolSchema", e);
                toolSchemaObj = tool?.inputSchema;
            }
            if (tool && typeof tool.toolMetadata === 'string' && tool.toolMetadata) {
                try {
                    toolMetadataObj = JSON.parse(tool.toolMetadata);
                } catch (e) {
                    console.error("Failed to parse toolMetadata", e);
                }
            }
            const obj: any = {
                name: tool?.name,
                endpoint: tool?.endpoint,
                method: tool?.method,
                path: tool?.path,
                description: tool?.description,
                inputSchema: toolSchemaObj,
                toolMetadata: toolMetadataObj,
                serviceId,
                apiType,
                protocol,
                envTag,
                targetHost
            };
            return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null));
        });
        const propertyValue = JSON.stringify(selectedTools);
        console.log('Saving MCP tools configuration', { selectedTools, propertyValue });

        let cmd: any;
        if (selectedTools.length > 0) {
            if (metadata.exists) {
                // Update
                cmd = {
                    host: 'lightapi.net', service: 'config', action: 'updateConfigInstanceApi', version: '0.1.0',
                    data: {
                        hostId: host,
                        instanceApiId,
                        propertyId: metadata.propertyId,
                        propertyValue: propertyValue,
                    },
                };
            } else {
                // Create
                if (!metadata.configId) {
                    setErrorMsg('Missing configId for mcp-router');
                    return;
                }
                cmd = {
                    host: 'lightapi.net', service: 'config', action: 'createConfigInstanceApi', version: '0.1.0',
                    data: {
                        hostId: host,
                        instanceApiId,
                        configId: metadata.configId,
                        propertyId: metadata.propertyId,
                        propertyValue: propertyValue,
                    },
                };
            }
        } else {
            if (metadata.exists) {
                // Delete
                cmd = {
                    host: 'lightapi.net', service: 'config', action: 'deleteConfigInstanceApi', version: '0.1.0',
                    data: {
                        hostId: host,
                        instanceApiId,
                        propertyId: metadata.propertyId,
                    },
                };
            } else {
                // Nothing to do
                setSuccessMsg('No tools selected, configuration remains unchanged.');
                return;
            }
        }

        try {
            await fetchClient('/portal/command', {
                method: 'POST',
                body: JSON.stringify(cmd),
            });
            setSuccessMsg('MCP Tools configuration task submitted successfully');
            // Refresh data to get updated version and status
            setTimeout(fetchData, 1000);
        } catch (error) {
            console.error(error);
            setErrorMsg('Failed to submit MCP tools configuration task');
        }
    };

    const handleCloseSuccess = () => setSuccessMsg('');
    const handleCloseError = () => setErrorMsg('');

    const columns = useMemo<MRT_ColumnDef<McpToolType>[]>(
        () => [
            { 
                accessorKey: 'name', 
                header: 'Name',
                enableEditing: true,
                Cell: ({ cell }) => (
                    <Tooltip title="Click to edit">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {cell.getValue<string>()}
                            <EditIcon sx={{ fontSize: '1rem', color: 'action.active', opacity: 0.5 }} />
                        </Box>
                    </Tooltip>
                ),
            },
            { 
                accessorKey: 'description', 
                header: 'Description',
                enableEditing: true,
                Cell: ({ cell }) => (
                    <Tooltip title="Click to edit">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {cell.getValue<string>()}
                            <EditIcon sx={{ fontSize: '1rem', color: 'action.active', opacity: 0.5 }} />
                        </Box>
                    </Tooltip>
                ),
            },
            { accessorKey: 'endpointId', header: 'Endpoint Id' },
            { accessorKey: 'endpoint', header: 'Endpoint' },
            { accessorKey: 'method', header: 'Method' },
            { accessorKey: 'path', header: 'Path' },
            { accessorKey: 'inputSchema', header: 'Input Schema' },
            { accessorKey: 'toolMetadata', header: 'Tool Metadata' },
        ],
        [],
    );

    const table = useMaterialReactTable({
        columns,
        data,
        initialState: { density: 'compact' },
        enableEditing: true,
        editDisplayMode: 'cell',
        muiTableBodyCellProps: ({ cell, row }) => ({
            onBlur: (event: any) => {
                const newValue = event.target.value;
                setData((prevData) =>
                    prevData.map((item) =>
                        item.endpointId === row.id
                            ? { ...item, [cell.column.id]: newValue }
                            : item
                    )
                );
            },
            sx: {
                cursor: cell.column.columnDef.enableEditing ? 'pointer' : 'default',
                '&:hover': cell.column.columnDef.enableEditing ? {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                } : {},
            }
        }),
        state: {
            isLoading,
            showAlertBanner: isError,
            rowSelection
        },
        enableRowSelection: true,
        getRowId: (row) => row.endpointId,
        onRowSelectionChange: setRowSelection,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enablePagination: false,
        enableColumnFilters: false,
        enableFilters: true,
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={!instanceApiId}
                    color="primary"
                >
                    Save Config
                </Button>
                {instanceName && (
                    <Typography variant="subtitle1">
                        Instance: <strong>{instanceName}</strong>
                    </Typography>
                )}
                {apiId && apiVersion && (
                    <Typography variant="subtitle1">
                        API: <strong>{apiId}@{apiVersion}</strong>
                    </Typography>
                )}
            </Box>
        ),
    });

    return (
        <>
            <MaterialReactTable table={table} />
            <Snackbar open={!!successMsg} autoHideDuration={6000} onClose={handleCloseSuccess}>
                <Alert onClose={handleCloseSuccess} severity="success" sx={{ width: '100%' }}>
                    {successMsg}
                </Alert>
            </Snackbar>
            <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={handleCloseError}>
                <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
                    {errorMsg}
                </Alert>
            </Snackbar>
        </>
    );
}
