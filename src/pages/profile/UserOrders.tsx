import CircularProgress from '@mui/material/CircularProgress';
import TablePagination from '@mui/material/TablePagination';
import Box from '@mui/material/Box';
import React, { useEffect, useState } from 'react';
import { useUserState } from '../../contexts/UserContext';
import UserOrderList from './UserOrderList';
import fetchClient from '../../utils/fetchClient';

export default function UserOrders(props: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [count, setCount] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const { email }: any = useUserState();

  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action: 'getCustomerOrder',
    version: '0.1.0',
    data: { email, offset: page * rowsPerPage, limit: rowsPerPage },
  };

  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  const queryOrders = async (url: string, headers: any) => {
    try {
      setLoading(true);
      const data: any = await fetchClient(url, { headers });
      setOrders(data.orders);
      setCount(data.total);
    } catch (e: any) {
      console.log(e);
      setError(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queryOrders(url, headers);
  }, [page, rowsPerPage]);

  const handleChangePage = (event: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </Box>
    );
  }

  return (
    <Box>
      <UserOrderList {...props} orders={orders} />
      <TablePagination
        rowsPerPageOptions={[10, 25, 100]}
        component="div"
        count={count}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Box>
  );
}
