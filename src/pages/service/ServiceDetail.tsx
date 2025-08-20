import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
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
import SettingsIcon from "@mui/icons-material/Settings";
import BugReportIcon from "@mui/icons-material/BugReport";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Widget from "../../components/Widget/Widget";
import useStyles from "./styles";
import Cookies from "universal-cookie";

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

export default function ServiceDetail() {
  const classes = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const { service } = location.state as { service: ServiceType };
  const { hostId, apiId } = service;

  // State for service versions data
  const [versions, setVersions] = useState<ServiceVersionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Data fetching for service versions
  useEffect(() => {
    const fetchVersions = async () => {
      if (!hostId || !apiId) return;

      const cmd = {
        host: "lightapi.net", service: "service", action: "getServiceVersion", version: "0.1.0",
        data: { hostId, apiId, offset: 0, limit: Number.MAX_SAFE_INTEGER }, // Fetch all versions
      };
      const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
      const cookies = new Cookies();
      const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

      try {
        setIsLoading(true);
        const response = await fetch(url, { headers, credentials: 'include' });
        const data = await response.json();
        console.log("data = ", data);
        setVersions(data || []);
      } catch (error) {
        console.error("Failed to fetch service versions:", error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVersions();
  }, [hostId, apiId]);

  // Column definitions for the MaterialReactTable
  const columns = useMemo<MRT_ColumnDef<ServiceVersionType>[]>(
    () => [
      { accessorKey: 'apiVersionId', header: 'Version Id' },
      { accessorKey: 'apiId', header: 'Api Id' },
      { accessorKey: 'apiVersion', header: 'Api Version' },
      { accessorKey: 'apiType', header: 'Api Type' },
      { accessorKey: 'apiVersionDesc', header: 'Description' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      { accessorKey: 'specLink', header: 'Spec Link' },
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
    data: versions, // Use the fetched versions data
    initialState: { showColumnFilters: true, density: 'compact' },
    state: {
      isLoading,
      showAlertBanner: isError,
    },
    getRowId: (row) => row.apiVersionId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading service versions' } : undefined,
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => navigate('/app/form/createServiceVersion', { state: { data: { apiId } } })}
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
