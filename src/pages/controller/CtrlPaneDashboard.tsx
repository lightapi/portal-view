import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import HelpIcon from '@mui/icons-material/Help';
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
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
  Tooltip,
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
  instanceStatus: string;
  connected: boolean;
};

// Define the grouped shape for the main table
type ServiceGroup = {
  serviceId: string;
  envTag: string;
  nodeCount: number;
  nodes: RuntimeInstanceRow[];
};

function CtrlPaneDashboard() {
  const navigate = useNavigate();
  const { filter } = useAppState() as { filter: string };
  const { instances, isMcpConnected, isEventsConnected, error } = useController();

  // Group instances by ServiceId and EnvTag
  const groupedData = useMemo(() => {
    const groups: { [key: string]: ServiceGroup } = {};
    Object.values(instances).forEach((instance) => {
      const key = `${instance.serviceId}|${instance.envTag || ''}`;
      if (!groups[key]) {
        groups[key] = {
          serviceId: instance.serviceId,
          envTag: instance.envTag || '',
          nodeCount: 0,
          nodes: [],
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
      });
    });
    return Object.values(groups);
  }, [instances]);

  // Derived filtered data based on App header filter
  const filteredData = useMemo(() => {
    if (!filter) return groupedData;
    return groupedData.filter(group => 
      group.serviceId.toLowerCase().includes(filter.toLowerCase()) ||
      group.envTag.toLowerCase().includes(filter.toLowerCase())
    );
  }, [groupedData, filter]);

  // Main table column definitions
  const columns = useMemo<MRT_ColumnDef<ServiceGroup>[]>(
    () => [
      { accessorKey: 'serviceId', header: 'Service Id' },
      { accessorKey: 'envTag', header: 'Environment Tag' },
      { accessorKey: 'nodeCount', header: 'Number of Nodes', muiTableBodyCellProps: { align: 'right' }, muiTableHeadCellProps: { align: 'right' } },
    ],
    []
  );

  const handleCheck = (node: RuntimeInstanceRow) => {
    const k = `${node.serviceId}|${node.envTag || ''}:${node.protocol}:${node.ipAddress}:${node.portNumber}`;
    navigate('/app/controller/check', { state: { data: { id: k, runtimeInstanceId: node.runtimeInstanceId } } });
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
    data: filteredData,
    getRowId: (row) => `${row.serviceId}|${row.envTag}`,
    enableExpandAll: false,
    enableExpanding: true,
    initialState: { density: 'compact' },
    state: { isLoading: !isMcpConnected && !error, showAlertBanner: !!error },
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
            label={isEventsConnected ? "Live Events Active" : "Events Disconnected"} 
            size="small" 
            color={isEventsConnected ? "success" : "warning"}
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
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Status Check</TableCell>
                <TableCell align="right">Server Info</TableCell>
                <TableCell align="right">Logger Config</TableCell>
                <TableCell align="right">Chaos Monkey</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {row.original.nodes.map((node) => (
                <TableRow key={node.runtimeInstanceId}>
                  <TableCell>{node.protocol}</TableCell>
                  <TableCell>{node.ipAddress}</TableCell>
                  <TableCell align="right">{node.portNumber}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={node.connected ? "Node is online" : "Node is offline"}>
                      <Chip 
                        label={node.instanceStatus} 
                        size="small" 
                        color={node.connected ? "success" : "default"} 
                        variant={node.connected ? "filled" : "outlined"}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="Status check" onClick={() => handleCheck(node)} disabled={!node.connected}>
                      <CloudDoneIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="Server info" onClick={() => handleInfo(node)} disabled={!node.connected}>
                      <HelpIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="Logger config" onClick={() => handleLogger(node)} disabled={!node.connected}>
                      <PermDataSettingIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="Chaos monkey" onClick={() => handleChaosMonkey(node)} disabled={!node.connected}>
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
