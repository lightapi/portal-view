import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  MRT_Row,
} from 'material-react-table';
import { Table, TableBody, TableCell, TableContainer, TableRow, Paper, Button, Box, Alert, Typography } from "@mui/material";
import ImageAspectRatioIcon from "@mui/icons-material/ImageAspectRatio";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import AddBoxIcon from "@mui/icons-material/AddBox";
import InputIcon from "@mui/icons-material/Input";
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import SettingsIcon from "@mui/icons-material/Settings";
import BugReportIcon from "@mui/icons-material/BugReport";
import ApiIcon from "@mui/icons-material/Api";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import Widget from "../../components/Widget/Widget";
import fetchClient from "../../utils/fetchClient";
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import { apiPost } from '../../api/apiPost';
import { applyOwnershipColumns, applyOwnershipFilter, hasAnyRole, ownershipScope } from '../../utils/ownershipScope';
import ApiGatewayPublicationDialog from './ApiGatewayPublicationDialog';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';
import { useUserState } from '../../contexts/UserContext';

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
  tagIds?: string[];
  tags?: string[];
  categoryIds?: string[];
  categories?: string[];
  apiStatus?: string;
  updateUser?: string;
  updateTs?: string;
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
  transportConfig?: string;
  protocol?: string;
  envTag?: string;
  targetHost?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active?: boolean;
};

const displayValue = (value: unknown) => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

export default function ApiDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<ServiceVersionType[]>([]);
  const { host, userId, email, roles, positions } = useUserState() as { host?: string; userId?: string; email?: string; roles?: string | null; positions?: string | null };
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const apiVersionOwnership = useMemo(
    () => ownershipScope({
      roles,
      userId,
      positions,
      ownerField: 'ownerUserId',
    }),
    [roles, userId, positions],
  );
  const ownedOnly = apiVersionOwnership.ownedOnly;
  const hasOwnerContext = apiVersionOwnership.hasOwnerContext;
  const state = location.state as { service?: ServiceType; data?: ServiceType } | null;
  const service = useMemo(
    () => state?.service ?? state?.data ?? {
      hostId: searchContext.hostId ?? host ?? '',
      apiId: searchContext.apiId ?? '',
      active: true,
    },
    [host, searchContext.apiId, searchContext.hostId, state?.data, state?.service],
  );
  const { hostId, apiId } = service;
  const [publicationVersion, setPublicationVersion] = useState<ServiceVersionType | null>(null);
  const canPublishToGateway = hasAnyRole(roles, ['admin', 'host-admin', 'api-admin']);
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId, apiId }),
    [apiId, hostId, searchContext],
  );

  // State for service versions data
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState<string | false>(false);

  // Data fetching for service versions
  useEffect(() => {
    const fetchVersions = async () => {
      if (!hostId || !apiId) return;
      if (ownedOnly && !userId) return;
      setIsLoading(true);

      const filters = applyOwnershipFilter([], apiVersionOwnership);
      const cmd = {
        host: "lightapi.net", service: "service", action: "getApiVersion", version: "0.1.0",
        data: { hostId, apiId, offset: 0, limit: Number.MAX_SAFE_INTEGER, filters: JSON.stringify(filters) },
      };
      const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

      try {
        const data = await fetchClient(url);
        console.log("data = ", data);
        setData(data || []);
      } catch (error) {
        console.error("Failed to fetch service versions:", error);
        setIsError(loadErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchVersions();
  }, [hostId, apiId, ownedOnly, userId, apiVersionOwnership]);

  const handleDelete = useCallback(async (row: MRT_Row<ServiceVersionType>) => {
    if (!apiVersionOwnership.canModifyRecord(row.original)) {
      alert('You can only delete API versions you own.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete app: ${row.original.apiVersionId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(app => app.apiVersionId !== row.original.apiVersionId));

    const cmd = {
      host: 'lightapi.net', service: 'service', action: 'deleteApiVersion', version: '0.1.0',
      data: { hostId: row.original.hostId, apiId: row.original.apiId, apiVersion: row.original.apiVersion , aggregateVersion: row.original.aggregateVersion},
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
  }, [apiVersionOwnership, data]);

  const handleUpdate = useCallback((row: MRT_Row<ServiceVersionType>) => {
    if (!apiVersionOwnership.canModifyRecord(row.original)) {
      alert('You can only update API versions you own.');
      return;
    }
    const apiVersionId = row.original.apiVersionId;
    // updateApiVersion owns the latest-record read through its identity-based prefill.
    // Do not call getFreshApiVersion here: that endpoint is an aggregate-concurrency
    // reconciliation check, not a general update-form read, and can reject a valid row
    // while the projection is catching up.
    // Record identity is required even when this page was opened outside Task Center.
    const identityParams = new URLSearchParams({
      hostId: row.original.hostId,
      apiId: row.original.apiId,
      apiVersionId,
    });
    navigate(buildTaskAwareRoute(`/app/form/updateApiVersion?${identityParams}`, searchParams, {
      ...taskContext,
      hostId: row.original.hostId,
      apiId: row.original.apiId,
      apiVersionId,
      serviceId: row.original.serviceId ?? '',
    }), {
      state: { source: location.pathname }
    });
  }, [apiVersionOwnership, navigate, location.pathname, searchParams, taskContext]);

  const contextForRow = useCallback((row: ServiceVersionType) => ({
    ...taskContext,
    hostId: row.hostId,
    apiId: row.apiId,
    apiVersionId: row.apiVersionId,
    serviceId: row.serviceId ?? '',
  }), [taskContext]);

  // Column definitions for the MaterialReactTable
  const columns = useMemo<MRT_ColumnDef<ServiceVersionType>[]>(
    () => applyOwnershipColumns([
      { accessorKey: 'apiVersionId', header: 'Version Id' },
      { accessorKey: 'apiId', header: 'Api Id' },
      { accessorKey: 'apiVersion', header: 'Api Version' },
      { accessorKey: 'apiType', header: 'Api Type' },
      { accessorKey: 'apiVersionDesc', header: 'Description' },
      { accessorKey: 'specLink', header: 'Spec Link' },
      { accessorKey: 'transportConfig', header: 'Transport Config' },
      { accessorKey: 'serviceId', header: 'Service Id' },
      { accessorKey: 'protocol', header: 'Protocol' },
      { accessorKey: 'envTag', header: 'Env Tag' },
      { accessorKey: 'targetHost', header: 'Target Host' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
    ],
      apiVersionOwnership,
    ),
    [apiVersionOwnership],
  );

  // Table instance configuration
  const table = useMaterialReactTable(usePortalActionTableOptions({
    columns,
    data: data,
    initialState: { showColumnFilters: true, density: 'compact' },
    state: {
      isLoading,
      showAlertBanner: Boolean(isError),
    },
    getRowId: (row) => row.apiVersionId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading api versions' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => <PortalActions row={row} actions={[
      {
        id: "update-api-version",
        label: "Update Api Version",
        icon: <SystemUpdateIcon />,
        disabledReason: () => (!apiVersionOwnership.canModifyRecord(row.original)) ? ('You can only update API versions you own.') : null,
        onSelect: () => handleUpdate(row)
      },
      {
        id: "edit-specification",
        label: "Edit Specification",
        description: "Open the API specification editor.",
        icon: <ImageAspectRatioIcon />,
        onSelect: () => {
          const path = row.original.apiType === 'openapi' ? '/app/openapiEditor' : row.original.apiType === 'hybrid' ? '/app/hybridEditor' : '/app/graphqlEditor';
          navigate(buildTaskAwareRoute(path, searchParams, contextForRow(row.original)), { state: { data: { serviceVersion: row.original } } });
        }
      },
      {
        id: "delete-api-version",
        label: "Delete Api Version",
        icon: <DeleteForeverIcon />,
        destructive: true,
        disabledReason: () => (!apiVersionOwnership.canModifyRecord(row.original)) ? ('You can only delete API versions you own.') : null,
        onSelect: () => handleDelete(row)
      },
      {
        id: "instance-api",
        label: "Instance API",
        icon: <ApiIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/instance/InstanceApi', searchParams, contextForRow(row.original)), { state: { data: { hostId: row.original.hostId, apiVersionId: row.original.apiVersionId, apiId: row.original.apiId, serviceId: row.original.serviceId } } })
      },
      {
        id: "publish-to-gateway",
        label: "Publish to Gateway",
        description: "Choose a gateway for this API version.",
        icon: <CloudUploadIcon />,
        hidden: () => !((canPublishToGateway)),
        onSelect: () => setPublicationVersion(row.original)
      },
      {
        id: "create-oauth-client",
        label: "Create OAuth Client",
        description: "Create an OAuth client with this record preselected.",
        icon: <VpnKeyIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/form/createClient', searchParams, contextForRow(row.original)), { state: { data: { hostId: row.original.hostId, apiVersionId: row.original.apiVersionId } } })
      },
      {
        id: "endpoint",
        label: "Endpoint",
        description: "Manage the API version endpoints.",
        icon: <FormatListBulletedIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/serviceEndpoint', searchParams, contextForRow(row.original)), { state: { data: { hostId: row.original.hostId, apiId: row.original.apiId, apiVersionId: row.original.apiVersionId } } })
      },
      {
        id: "codegen",
        label: "Codegen",
        description: "Generate an implementation from this API version.",
        icon: <InputIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/serviceCodegen', searchParams, contextForRow(row.original)), { state: { data: { hostId: row.original.hostId, apiId: row.original.apiId } } })
      },
      {
        id: "deploy",
        label: "Deploy",
        description: "Open deployment options for this API version.",
        icon: <SettingsIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/serviceDeploy', searchParams, contextForRow(row.original)), { state: { data: { hostId: row.original.hostId, apiId: row.original.apiId } } })
      },
      {
        id: "test",
        label: "Test",
        description: "Open the API test page.",
        icon: <BugReportIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/serviceTest', searchParams, contextForRow(row.original)), { state: { data: { hostId: row.original.hostId, apiId: row.original.apiId } } })
      }
    ]} />,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate(buildTaskAwareRoute('/app/form/createApiVersion', searchParams, taskContext), { state: { data: { apiId } } })}
        >
          Create New Version
        </Button>
        {ownedOnly ? (
          <Typography variant="subtitle1">My API Versions: <strong>{email || userId}</strong></Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All API Versions</Typography>
        )}
      </Box>
    ),
  }));

  return (
    <>
    <Box>
      <Widget
        title="Service Detail"
        upperTitle
        sx={{ minHeight: "100%", display: "flex", flexDirection: "column" }}
        bodySx={{ display: "flex", flexGrow: 1, flexDirection: "column", justifyContent: "space-between" }}
      >
        <TableContainer component={Paper}>
          <Table>
            <TableBody>
              {Object.entries(service).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                  <TableCell>{displayValue(value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Widget>

      <Box mt={2}>
        <TaskActionPanel
          title="Recommended Task Actions"
          context={taskContext}
          taskIds={["publish-api", "mcp-onboard-api"]}
        />
      </Box>

      <Box mt={2}>
        {!hasOwnerContext && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            User context is required before owner-scoped API versions can be loaded.
          </Alert>
        )}
          <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
      </Box>
    </Box>
      {publicationVersion && (
        <ApiGatewayPublicationDialog
          open
          hostId={publicationVersion.hostId}
          apiVersionId={publicationVersion.apiVersionId}
          apiVersion={publicationVersion.apiVersion}
          onClose={() => setPublicationVersion(null)}
        />
      )}
    </>
  );
}
