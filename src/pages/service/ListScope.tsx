import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import { Box, Tooltip } from '@mui/material';
import fetchClient from "../../utils/fetchClient";

type ScopeType = {
  hostId: string;
  endpoint: string;
  endpointId: string;
  scope: string;
  scopeDesc: string;
  active: boolean;
};

const TruncatedCell = ({ cell }: { cell: any }) => {
  const value = cell.getValue() ?? '';
  return (
    <Tooltip title={value} placement="top-start">
      <Box component="span" sx={{ display: 'block', maxWidth: '300px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {value}
      </Box>
    </Tooltip>
  );
};

export default function ListScope() {
  const location = useLocation();
  const { hostId, endpointId } = location.state || {};

  const [data, setData] = useState<ScopeType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);

  const fetchData = useCallback(async () => {
    if (!hostId || !endpointId) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: "lightapi.net",
      service: "service",
      action: "getApiEndpointScope",
      version: "0.1.0",
      data: { hostId, endpointId },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = await fetchClient(url);
      setData(json || []);
    } catch (error) {
      setIsError(true);
      console.error(error);
    } finally {
      setIsError(false);
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [hostId, endpointId, data.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo<MRT_ColumnDef<ScopeType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'endpoint', header: 'Endpoint' },
      { accessorKey: 'endpointId', header: 'EndpointId' },
      { accessorKey: 'scope', header: 'Scope' },
      { accessorKey: 'scopeDesc', header: 'Scope Desc', Cell: TruncatedCell },
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

  const table = useMaterialReactTable({
    columns,
    data,
    enablePagination: false,
    enableRowActions: false, // Disabling actions because scopes are populated by specification
    enableGlobalFilter: true,
    enableColumnFilters: true,
    initialState: { density: 'compact', showColumnFilters: true },
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading scopes' } : undefined,
    state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching },
  });

  return <MaterialReactTable table={table} />;
}
