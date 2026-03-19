import CheckIcon from '@mui/icons-material/Check';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ReplyIcon from '@mui/icons-material/Reply';
import {
  Box,
  Collapse,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserState } from '../../contexts/UserContext';
import { timeConversion } from '../../utils';
import fetchClient from '../../utils/fetchClient';

interface RowProps {
  row: any;
}

function Row({ row }: RowProps) {
  const [fetching, setFetching] = useState(false);
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { email }: any = useUserState();

  const replyMessage = (userId: string, subject: string) => {
    navigate('/app/form/privateMessage', {
      state: { data: { userId, subject } },
    });
  };

  const deliverOrder = (customerUserId: string, orderId: string) => {
    if (window.confirm('Are you sure you want to mark the order delivered?')) {
      const body = {
        host: 'lightapi.net',
        service: 'user',
        action: 'deliverOrder',
        version: '0.1.0',
        data: { email, customerUserId, orderId },
      };
      const url = '/portal/command';
      const headers = {
        'Content-Type': 'application/json',
      };
      postApi(url, headers, body);
    }
  };

  const postApi = async (url: string, headers: any, action: any) => {
    setFetching(true);
    try {
      const data = await fetchClient(url, {
        method: 'POST',
        body: JSON.stringify(action),
        headers,
      });
      setFetching(false);
      navigate(action.success || '/app/profile', { state: { data } });
    } catch (e: any) {
      console.log(e);
      setFetching(false);
      navigate(action.failure || '/app/profile', { state: { error: e } });
    }
  };

  return (
    <React.Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          {timeConversion(new Date().getTime() - row.timestamp)}
        </TableCell>
        <TableCell align="left">
          <ReplyIcon
            onClick={() => replyMessage(row.merchantUserId, row.orderId)}
            sx={{ cursor: 'pointer', mr: 1, verticalAlign: 'middle' }}
          />
          {row.merchantUserId}
        </TableCell>
        <TableCell align="left">{row.orderId}</TableCell>
        <TableCell align="left">{row.passCode}</TableCell>
        <TableCell align="left">
          {row.delivery?.pickupTime} {row.delivery?.instruction}
        </TableCell>
        <TableCell align="left">{row.payment?.method}</TableCell>
        <TableCell align="right">
          <CheckIcon
            onClick={() => deliverOrder(row.customerUserId, row.orderId)}
            sx={{ cursor: 'pointer' }}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Table size="small" aria-label="purchases">
                <TableHead>
                  <TableRow>
                    <TableCell>Sku</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Qty.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {row.items?.map((item: any) => (
                    <TableRow key={item.sku}>
                      <TableCell component="th" scope="row">
                        {item.sku}
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">{item.price}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
}

interface MerchantOrderListProps {
  orders: any[];
}

export default function MerchantOrderList({ orders }: MerchantOrderListProps) {
  return (
    <TableContainer component={Paper}>
      <Table aria-label="collapsible table">
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Time</TableCell>
            <TableCell align="left">Merchant</TableCell>
            <TableCell align="left">Order Id</TableCell>
            <TableCell align="left">Pass Code</TableCell>
            <TableCell align="left">Delivery</TableCell>
            <TableCell align="left">Payment</TableCell>
            <TableCell align="right">Deliver</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders && orders.map((order, index) => (
            <Row key={index} row={order} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
