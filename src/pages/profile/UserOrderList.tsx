import CancelIcon from '@mui/icons-material/Cancel';
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
import { timeConversion } from '../../utils';

interface RowProps {
  row: any;
}

function Row({ row }: RowProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const replyMessage = (userId: string, subject: string) => {
    navigate('/app/form/privateMessage', {
      state: { data: { userId, subject } },
    });
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
          <CancelIcon
            onClick={() =>
              console.log(
                'cancel is clicked',
                row.timestamp,
                row.merchantUserId,
                row.orderId
              )
            }
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

interface UserOrderListProps {
  orders: any[];
}

export default function UserOrderList({ orders }: UserOrderListProps) {
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
            <TableCell align="right">Cancel</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders && orders.map((order: any, index: number) => (
            <Row key={index} row={order} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
