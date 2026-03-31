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
} from '@mui/material';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAppState } from '../../contexts/AppContext';
import { useUserState } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import fetchClient from '../../utils/fetchClient';

// Define the type for a single runtime instance record
type RuntimeInstanceType = {
  hostId: string;
  runtimeInstanceId: string;
  serviceId: string;
  envTag?: string;
  protocol: string;
  ipAddress: string;
  portNumber: number;
  instanceStatus: string;
  aggregateVersion?: number;
  active: boolean;
};

// Define the grouped shape for the main table
type ServiceGroup = {
  serviceId: string;
  envTag: string;
  nodeCount: number;
  nodes: RuntimeInstanceType[];
};

// Define the shape of the API response
type RuntimeInstanceApiResponse = {
  runtimeInstances: Array<RuntimeInstanceType>;
  total: number;
};

function CtrlPaneDashboard() {
  const navigate = useNavigate();
  const { host } = useUserState() as { host: string };
  const { filter } = useAppState() as { filter: string };

  const [data, setData] = useState<ServiceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    if (!host) return;
    setIsLoading(true);
    setIsError(false);

    try {
      const limit = 1000;
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      const instances: RuntimeInstanceType[] = [];

      while (offset < total) {
        const cmd = {
          host: 'lightapi.net',
          service: 'instance',
          action: 'getRuntimeInstance',
          version: '0.1.0',
          data: {
            hostId: host,
            offset,
            limit,
            active: true,
          },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        const json = (await fetchClient(url, { signal })) as RuntimeInstanceApiResponse;
        const page = json.runtimeInstances || [];
        instances.push(...page);
        total = json.total || 0;
        offset += page.length;

        if (page.length < limit) {
          break;
        }
      }

      if (signal.aborted) {
        return;
      }

      // Group by ServiceId and EnvTag
      const groups: { [key: string]: ServiceGroup } = {};
      instances.forEach((instance) => {
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
        groups[key].nodes.push(instance);
      });

      setData(Object.values(groups));
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      console.error('Failed to fetch runtime instances:', error);
      setIsError(true);
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [host]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchData(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchData]);

  // Derived filtered data based on App header filter
  const filteredData = useMemo(() => {
    if (!filter) return data;
    return data.filter(group => 
      group.serviceId.toLowerCase().includes(filter.toLowerCase()) ||
      group.envTag.toLowerCase().includes(filter.toLowerCase())
    );
  }, [data, filter]);

  // Main table column definitions
  const columns = useMemo<MRT_ColumnDef<ServiceGroup>[]>(
    () => [
      { accessorKey: 'serviceId', header: 'Service Id' },
      { accessorKey: 'envTag', header: 'Environment Tag' },
      { accessorKey: 'nodeCount', header: 'Number of Nodes', muiTableBodyCellProps: { align: 'right' }, muiTableHeadCellProps: { align: 'right' } },
    ],
    []
  );

  const handleCheck = (node: RuntimeInstanceType) => {
    // k = id + ':' + node.protocol + ':' + node.address + ':' + node.port;
    const k = `${node.serviceId}|${node.envTag || ''}:${node.protocol}:${node.ipAddress}:${node.portNumber}`;
    navigate('/app/controller/check', { state: { data: { id: k } } });
  };

  const handleLogger = (node: RuntimeInstanceType) => {
    navigate('/app/controller/logger', { 
      state: { 
        data: { 
          node: {
            protocol: node.protocol,
            address: node.ipAddress,
            port: node.portNumber,
            apiName: node.serviceId
          } 
        } 
      } 
    });
  };

  const handleInfo = (node: RuntimeInstanceType) => {
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
        },
      },
    });
  };

  const handleChaosMonkey = (node: RuntimeInstanceType) => {
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
    state: { isLoading: isLoading, showAlertBanner: isError },
    muiToolbarAlertBannerProps: isError
      ? { color: 'error', children: 'Error loading runtime instances' }
      : undefined,
    renderDetailPanel: ({ row }) => (
      <Box sx={{ margin: 1 }}>
        <Typography variant="h6" gutterBottom component="div">
          Nodes
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Protocol</TableCell>
                <TableCell>Address</TableCell>
                <TableCell align="right">Port</TableCell>
                <TableCell align="right">Status Check</TableCell>
                <TableCell align="right">Server Info</TableCell>
                <TableCell align="right">Logger Config</TableCell>
                <TableCell align="right">Chaos Monkey</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {row.original.nodes.map((node) => (
                <TableRow key={node.runtimeInstanceId ?? `${node.serviceId}-${node.envTag ?? ''}-${node.protocol}-${node.ipAddress}-${node.portNumber}`}>
                  <TableCell>{node.protocol}</TableCell>
                  <TableCell>{node.ipAddress}</TableCell>
                  <TableCell align="right">{node.portNumber}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleCheck(node)}>
                      <CloudDoneIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleInfo(node)}>
                      <HelpIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleLogger(node)}>
                      <PermDataSettingIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleChaosMonkey(node)}>
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
