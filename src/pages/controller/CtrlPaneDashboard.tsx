import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import HelpIcon from '@mui/icons-material/Help';
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ExpandedState,
  type MRT_ColumnFiltersState,
} from 'material-react-table';
import {
  Box,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
} from '@mui/material';
import React, { useMemo } from 'react';
import { useAppState } from '../../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { useController } from '../../contexts/ControllerContext';

// Define the type for a single runtime instance record (local view)
type RuntimeInstanceRow = {
  runtimeInstanceId: string;
  serviceId: string;
  envTag?: string;
  protocol: string;
  ipAddress: string;
  portNumber: number;
  active: boolean;
};

// Define the grouped shape for the main table
type ServiceGroup = {
  serviceId: string;
  envTag: string;
  nodeCount: number;
  nodes: RuntimeInstanceRow[];
  status: 'All Live' | 'Partial Live' | 'None Live';
};

function CtrlPaneDashboard() {
  const navigate = useNavigate();
  const { filter } = useAppState() as { filter: string };
  const { instances, isLiveConnected, error } = useController();

  // Table state management
  const [expanded, setExpanded] = React.useState<MRT_ExpandedState>({});
  const [columnFilters, setColumnFilters] = React.useState<MRT_ColumnFiltersState>([]);

  // Group instances by ServiceId and EnvTag
  const groupedData = useMemo(() => {
    if (import.meta.env.DEV) {
      console.debug('CtrlPaneDashboard: processing instances', instances);
    }
    const groups: { [key: string]: ServiceGroup } = {};
    Object.values(instances).forEach((instance) => {
      const key = `${instance.serviceId}|${instance.envTag || ''}`;
      if (!groups[key]) {
        groups[key] = {
          serviceId: instance.serviceId,
          envTag: instance.envTag || '',
          nodeCount: 0,
          nodes: [],
          status: 'None Live',
        };
      }
      groups[key].nodeCount += 1;
      groups[key].nodes.push({
        runtimeInstanceId: instance.runtimeInstanceId,
        serviceId: instance.serviceId,
        envTag: instance.envTag,
        protocol: instance.metadata.protocol,
        ipAddress: instance.metadata.address,
        portNumber: instance.metadata.port,
        instanceStatus: instance.connected ? 'Connected' : 'Disconnected',
        connected: instance.connected,
        active: instance.active,
      });
    });

    const result = Object.values(groups).map(group => {
      const healthyCount = group.nodes.filter(n => n.active).length;
      if (healthyCount === group.nodeCount && group.nodeCount > 0) {
        group.status = 'All Live';
      } else if (healthyCount === 0) {
        group.status = 'None Live';
      } else {
        group.status = 'Partial Live';
      }
      return group;
    });

    return result;
  }, [instances]);

  // Main table column definitions
  const columns = useMemo<MRT_ColumnDef<ServiceGroup>[]>(
    () => [
      { accessorKey: 'serviceId', header: 'Service Id', enableColumnFilter: true },
      { accessorKey: 'envTag', header: 'Environment Tag', enableColumnFilter: true },
      { 
        accessorKey: 'status', 
        header: 'Status', 
        filterVariant: 'select',
        filterSelectOptions: ['All Live', 'Partial Live', 'None Live'],
        Cell: ({ cell }) => {
          const status = cell.getValue<string>();
          const color = status === 'All Live' ? 'success' : status === 'Partial Live' ? 'warning' : 'error';
          return (
            <Chip 
              label={status} 
              size="small" 
              color={color}
              variant="outlined" 
            />
          );
        }
      },
      { accessorKey: 'nodeCount', header: 'Number of Nodes', muiTableBodyCellProps: { align: 'right' }, muiTableHeadCellProps: { align: 'right' }, enableColumnFilter: false },
    ],
    []
  );

  const handleCheck = (node: RuntimeInstanceRow) => {
    navigate('/app/controller/check', { state: { data: { runtimeInstanceId: node.runtimeInstanceId } } });
  };
 
  const handleLogger = (node: RuntimeInstanceRow) => {
    navigate('/app/controller/logger', { 
      state: { 
        data: { 
          node: {
            protocol: node.protocol,
            address: node.ipAddress,
            port: node.portNumber,
            apiName: node.serviceId,
            runtimeInstanceId: node.runtimeInstanceId
          } 
        } 
      } 
    });
  };
 
  const handleInfo = (node: RuntimeInstanceRow) => {
    const originUrl =
      typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.host
        : 'null';
    navigate('/app/controller/info', {
      state: {
        data: {
          node: `${node.ipAddress}:${node.portNumber}`,
          protocol: node.protocol,
          address: node.ipAddress,
          port: node.portNumber,
          baseUrl: originUrl,
          runtimeInstanceId: node.runtimeInstanceId,
        },
      },
    });
  };
 
  const handleChaosMonkey = (node: RuntimeInstanceRow) => {
    const originUrl =
      typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.host
        : 'null';
    navigate('/app/controller/chaos', {
      state: {
        data: {
          protocol: node.protocol,
          address: node.ipAddress,
          port: node.portNumber,
          baseUrl: originUrl,
          runtimeInstanceId: node.runtimeInstanceId,
        },
      },
    });
  };
 
  const table = useMaterialReactTable({
    columns,
    data: groupedData,
    getRowId: (row) => `${row.serviceId}|${row.envTag}`,
    enableExpandAll: false,
    enableExpanding: true,
    getRowCanExpand: () => true,
    positionExpandColumn: 'first',
    enableColumnFilters: true,
    initialState: { showColumnFilters: true, density: 'compact' },
    state: { 
      isLoading: Object.keys(instances).length === 0 && !isLiveConnected && !error, 
      showAlertBanner: !!error,
      globalFilter: filter,
      expanded,
      columnFilters
    },
    onExpandedChange: setExpanded,
    onColumnFiltersChange: setColumnFilters,
    muiToolbarAlertBannerProps: error
      ? { color: 'error', children: error }
      : undefined,
    renderDetailPanel: ({ row }) => (
      <Box sx={{ margin: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 2 }}>
          <Typography variant="h6" component="div">
            Nodes
          </Typography>
          <Chip 
            label={isLiveConnected ? "Live Control Plane Connected" : "Control Plane Disconnected"} 
            size="small" 
            color={isLiveConnected ? "success" : "warning"}
            variant="outlined" 
          />
        </Box>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Protocol</TableCell>
                <TableCell>Address</TableCell>
                <TableCell align="right">Port</TableCell>
                <TableCell align="center">Active</TableCell>
                <TableCell align="right">Check</TableCell>
                <TableCell align="right">Info</TableCell>
                <TableCell align="right">Logger</TableCell>
                <TableCell align="right">Chaos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {row.original.nodes.map((node) => (
                <TableRow key={node.runtimeInstanceId}>
                  <TableCell>{node.protocol}</TableCell>
                  <TableCell>{node.ipAddress}</TableCell>
                  <TableCell align="right">{node.portNumber}</TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={node.active ? "Active" : "Inactive"} 
                      size="small" 
                      color={node.active ? "success" : "error"}
                      variant="outlined" 
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="Status check" onClick={() => handleCheck(node)} disabled={!node.active}>
                      <CloudDoneIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="Server info" onClick={() => handleInfo(node)} disabled={!node.active}>
                      <HelpIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="Logger config" onClick={() => handleLogger(node)} disabled={!node.active}>
                      <PermDataSettingIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="Chaos monkey" onClick={() => handleChaosMonkey(node)} disabled={!node.active}>
                      <AssessmentIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    ),
  });

  return (
    <Box className="App" sx={{ p: 2 }}>
      <MaterialReactTable table={table} />
    </Box>
  );
}

export default CtrlPaneDashboard;
