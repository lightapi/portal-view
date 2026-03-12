import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_RowSelectionState,
} from 'material-react-table';
import { Box, Button, Typography, Alert, Snackbar } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { useUserState } from "../../contexts/UserContext";
import fetchClient from "../../utils/fetchClient";

type McpToolType = {
    endpointName: string;
    endpointId: string;
    endpoint: string;
    httpMethod?: string;
    endpointPath?: string;
    endpointDesc: string;
    toolSchema?: string;
    toolMetadata?: string;
    selected: boolean;
};

interface UserState {
    host?: string;
}

export default function InstanceApiMcpTool() {
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const initialData = location.state?.data || {};
    const { instanceApiId, apiVersion, apiId, instanceName, apiVersionId, serviceId, apiType, protocol, envTag, targetHost } = initialData;

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
        if (!host || !instanceApiId || !apiVersion || !apiId || !apiVersionId) return;
        setIsLoading(true);

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
            const fetchedData: McpToolType[] = json?.endpoints || [];
            console.log(fetchedData);
            setData(fetchedData);
            setMetadata({
                propertyId: json?.propertyId || null,
                configId: json?.configId || null,
                aggregateVersion: json?.aggregateVersion || 0,
                exists: json?.exists || false,
            });

            const initialSelection: MRT_RowSelectionState = {};
            fetchedData.forEach(row => {
                if (row.selected) {
                    initialSelection[row.endpointName] = true;
                }
            });
            setRowSelection(initialSelection);
        } catch (error) {
            setIsError(true);
            console.error(error);
            setErrorMsg('Failed to load MCP tools');
        } finally {
            setIsError(false);
            setIsLoading(false);
        }
    }, [host, instanceApiId, apiVersion, apiId, apiVersionId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async () => {
        if (!host || !instanceApiId || !metadata.propertyId) return;

        const selectedToolsNames = Object.keys(rowSelection).filter(key => rowSelection[key]);
        const selectedTools = selectedToolsNames.map(name => {
            const tool = data.find(t => t.endpointName === name);
            let toolSchemaObj = null;
            let toolMetadataObj = null;
            try {
                if (tool?.toolSchema) toolSchemaObj = JSON.parse(tool.toolSchema);
            } catch (e) {
                console.error("Failed to parse toolSchema", e);
                toolSchemaObj = tool?.toolSchema;
            }
            try {
                if (tool?.toolMetadata) toolMetadataObj = JSON.parse(tool.toolMetadata);
            } catch (e) {
                console.error("Failed to parse toolMetadata", e);
                toolMetadataObj = tool?.toolMetadata;
            }
            return {
                endpointName: name,
                endpoint: tool?.endpoint,
                httpMethod: tool?.httpMethod,
                endpointPath: tool?.endpointPath,
                endpointDesc: tool?.endpointDesc,
                toolSchema: toolSchemaObj,
                toolMetadata: toolMetadataObj,
                serviceId,
                apiType,
                protocol,
                envTag,
                targetHost
            };
        });
        const propertyValue = JSON.stringify(selectedTools);

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
            { accessorKey: 'endpointName', header: 'Endpoint Name' },
            { accessorKey: 'endpointId', header: 'Endpoint Id' },
            { accessorKey: 'endpoint', header: 'Endpoint' },
            { accessorKey: 'httpMethod', header: 'HTTP Method' },
            { accessorKey: 'endpointPath', header: 'Endpoint Path' },
            { accessorKey: 'endpointDesc', header: 'Description' },
            { accessorKey: 'toolSchema', header: 'Tool Schema' },
            { accessorKey: 'toolMetadata', header: 'Tool Metadata' },
        ],
        [],
    );

    const table = useMaterialReactTable({
        columns,
        data,
        initialState: { density: 'compact' },
        state: {
            isLoading,
            showAlertBanner: isError,
            rowSelection
        },
        enableRowSelection: true,
        getRowId: (row) => row.endpointName,
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
