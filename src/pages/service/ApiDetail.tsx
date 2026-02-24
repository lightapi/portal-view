import { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  MRT_Row,
} from 'material-react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
  Box,
} from "@mui/material";
import ImageAspectRatioIcon from "@mui/icons-material/ImageAspectRatio";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import AddBoxIcon from "@mui/icons-material/AddBox";
import InputIcon from "@mui/icons-material/Input";
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import SettingsIcon from "@mui/icons-material/Settings";
import BugReportIcon from "@mui/icons-material/BugReport";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Widget from "../../components/Widget/Widget";
import useStyles from "./styles";
import Cookies from "universal-cookie";
import { apiPost } from '../../api/apiPost';

// --- Type Definitions ---
type ServiceType = {
  hostId: string;
  apiId: string;
  apiType?: string;
  serviceId?: string;
  apiName?: string;
  apiDesc?: string;
  operationOwner?: string;
  deliveryOwner?: string;
  region?: string;
  businessGroup?: string;
  lob?: string;
  platform?: string;
  capability?: string;
  gitRepo?: string;
  aggregateVersion?: number;
  apiTags?: string;
  apiStatus?: string;
  active: boolean;
};

type ServiceVersionType = {
  hostId: string;
  apiVersionId: string;
  apiId: string;
  apiVersion: string;
  apiType: 'openapi' | 'hybrid' | 'graphql' | string;
  serviceId?: string;
  apiVersionDesc?: string;
  specLink?: string;
  aggregateVerison?: number;
};

export default function ApiDetail() {
  const classes = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<ServiceVersionType[]>([]);
  const { service } = location.state as { service: ServiceType };
  const { hostId, apiId } = service;
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null); // Will store the appId being fetched

  // State for service versions data
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isError, setIsError] = useState(false);

  // Data fetching for service versions
  useEffect(() => {
    const fetchVersions = async () => {
      if (!hostId || !apiId) return;
      if (!data.length) setIsLoading(true); else setIsRefetching(true);

      const cmd = {
        host: "lightapi.net", service: "service", action: "getApiVersion", version: "0.1.0",
        data: { hostId, apiId, offset: 0, limit: Number.MAX_SAFE_INTEGER },
      };
      const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
      const cookies = new Cookies();
      const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

      try {
        setIsLoading(true);
        const response = await fetch(url, { headers, credentials: 'include' });
        const data = await response.json();
        console.log("data = ", data);
        setData(data || []);
      } catch (error) {
        console.error("Failed to fetch service versions:", error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVersions();
  }, [hostId, apiId]);

  const handleDelete = useCallback(async (row: MRT_Row<ServiceVersionType>) => {
    if (!window.confirm(`Are you sure you want to delete app: ${row.original.apiVersionId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(app => app.apiVersionId !== row.original.apiVersionId));

    const cmd = {
      host: 'lightapi.net', service: 'service', action: 'deleteApiVersion', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete app. Please try again.');
        setData(originalData);
      }
    } catch (e) {
      alert('Failed to delete app due to a network error.');
      setData(originalData);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<ServiceVersionType>) => {
    const apiVersionId = row.original.apiVersionId;
    setIsUpdateLoading(apiVersionId);

    const cmd = {
      host: 'lightapi.net', service: 'service', action: 'getFreshApiVersion', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const freshData = await response.json();
      console.log("freshData", freshData);
      if (!response.ok) {
        throw new Error(freshData.description || 'Failed to fetch latest api version data.');
      }
      
      // Navigate with the fresh data
      navigate('/app/form/updateApiVersion', { 
        state: { 
          data: freshData, 
          source: location.pathname 
        } 
      });
    } catch (error) {
      console.error("Failed to fetch api version for update:", error);
      alert("Could not load the latest api version data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [navigate, location.pathname]);

  // Column definitions for the MaterialReactTable
  const columns = useMemo<MRT_ColumnDef<ServiceVersionType>[]>(
    () => [
      { accessorKey: 'apiVersionId', header: 'Version Id' },
      { accessorKey: 'apiId', header: 'Api Id' },
      { accessorKey: 'apiVersion', header: 'Api Version' },
      { accessorKey: 'apiType', header: 'Api Type' },
      { accessorKey: 'apiVersionDesc', header: 'Description' },
      { accessorKey: 'specLink', header: 'Spec Link' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Update Api Version">
            <IconButton 
              onClick={() => handleUpdate(row)}
              disabled={isUpdateLoading === row.original.apiVersionId}
            >
              {isUpdateLoading === row.original.apiVersionId ? (
                <CircularProgress size={22} />
              ) : (
                <SystemUpdateIcon />
              )}
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'specEdit', header: 'Spec Edit', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Edit Specification">
            <IconButton onClick={() => {
              const path = row.original.apiType === 'openapi' ? '/app/openapiEditor' : row.original.apiType === 'hybrid' ? '/app/hybridEditor' : '/app/graphqlEditor';
              navigate(path, { state: { data: { serviceVersion: row.original } } });
            }}>
              <ImageAspectRatioIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Api Version"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
      {
        id: 'instanceApi', header: 'Instance API', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Instance API">
            <IconButton onClick={() => navigate('/app/instance/InstanceApi', { state: { data: { hostId: row.original.hostId, apiVersionId: row.original.apiVersionId } } })}>
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'endpoint', header: 'Endpoint', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Endpoint">
            <IconButton onClick={() => navigate('/app/serviceEndpoint', { state: { data: { hostId: row.original.hostId, apiVersionId: row.original.apiVersionId } } })}>
              <FormatListBulletedIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      // START: Added Missing Actions
      {
        id: 'codegen', header: 'Codegen', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Codegen">
            <IconButton onClick={() => navigate('/app/serviceCodegen', { state: { data: { hostId: row.original.hostId, apiId: row.original.apiId } } })}>
              <InputIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'deploy', header: 'Deploy', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Deploy">
            <IconButton onClick={() => navigate('/app/serviceDeploy', { state: { data: { hostId: row.original.hostId, apiId: row.original.apiId } } })}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'test', header: 'Test', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Test">
            <IconButton onClick={() => navigate('/app/serviceTest', { state: { data: { hostId: row.original.hostId, apiId: row.original.apiId } } })}>
              <BugReportIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      // END: Added Missing Actions
    ],
    [navigate],
  );

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data: data,
    initialState: { showColumnFilters: true, density: 'compact' },
    state: {
      isLoading,
      showAlertBanner: isError,
    },
    getRowId: (row) => row.apiVersionId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading api versions' } : undefined,
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => navigate('/app/form/createApiVersion', { state: { data: { apiId } } })}
      >
        Create New Version
      </Button>
    ),
  });

  return (
    <Box>
      <Widget title="Service Detail" upperTitle bodyClass={classes.fullHeightBody} className={classes.card}>
        <TableContainer component={Paper}>
          <Table>
            <TableBody>
              {Object.entries(service).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                  <TableCell>{String(value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Widget>

      <Box mt={2}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
