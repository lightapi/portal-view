import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import { Box, Tooltip, Typography } from '@mui/material';
import fetchClient from '../../utils/fetchClient';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type ProviderKeyType = {
  providerId: string;
  kid: string;
  keyType: string;
  publicKey?: string;
  privateKey?: string;
  updateUser?: string;
  updateTs?: string;
};

// --- Main ProviderKey Component ---
export default function ProviderKey() {
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const initialData = useMemo(
    () => ({ ...searchContext, ...(location.state?.data || {}) }),
    [location.state, searchContext],
  );
  const providerId = initialData.providerId;
  const hostId = initialData.hostId;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId: hostId ?? '',
      providerId: providerId ?? '',
      kid: initialData.kid ?? '',
    }),
    [hostId, initialData.kid, providerId, searchContext],
  );
  // Data and fetching state
  const [data, setData] = useState<ProviderKeyType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data fetching logic (fetches all keys for the provider)
  useEffect(() => {
    if (!providerId || !hostId) {
      console.error("ProviderKey page loaded without providerId or hostId.");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    const fetchKeys = async () => {
      setIsLoading(true);
      setIsError(false);
      const cmd = {
        host: 'lightapi.net', service: 'oauth', action: 'getProviderKey', version: '0.1.0',
        data: { hostId: hostId, providerId: providerId },
      };
      const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

      try {
        const jsonData = await fetchClient(url);
        setData(jsonData || []);
      } catch (error) {
        console.error(error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchKeys();
  }, [providerId, hostId]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ProviderKeyType>[]>(
    () => [
      { accessorKey: 'kid', header: 'Key ID (kid)' },
      {
        accessorKey: 'keyType',
        header: 'Key Type',
        filterVariant: 'select',
        filterSelectOptions: [
          { text: 'Long Current', value: 'LC' },
          { text: 'Long Previous', value: 'LP' },
          { text: 'Token Current', value: 'TC' },
          { text: 'Token Previous', value: 'TP' },
        ],
      },
      {
        accessorKey: 'publicKey',
        header: 'Public Key',
        // Truncate long keys for better display
        muiTableBodyCellProps: {
          sx: {
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }
        },
        Cell: ({ cell }) => <Tooltip title={cell.getValue<string>()}><span>{cell.getValue<string>()}</span></Tooltip>
      },
      {
        accessorKey: 'privateKey',
        header: 'Private Key',
        muiTableBodyCellProps: {
          sx: {
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }
        },
        Cell: ({ cell }) => <Tooltip title={cell.getValue<string>() ?? ''}><span>{cell.getValue<string>()}</span></Tooltip>
      },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs', header: 'Update Time',
        Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
    ],
    [],
  );

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data, // Data is handled client-side by MRT
    initialState: { showColumnFilters: true, density: 'compact' },
    // No manual props needed for client-side operations
    state: {
      isLoading,
      showAlertBanner: isError,
    },
    getRowId: (row) => `${row.providerId}-${row.kid}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading keys' } : undefined,
    renderTopToolbarCustomActions: () => (
      <Typography variant="h6">
        Keys for Provider: <strong>{providerId}</strong>
      </Typography>
    ),
  });

  return (
    <Box>
      <TaskActionPanel
        title="OAuth Provider Tasks"
        context={taskContext}
        taskIds={['manage-oauth-provider']}
        maxActions={3}
      />
      <Box mt={2}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
