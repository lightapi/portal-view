import CancelIcon from '@mui/icons-material/Cancel';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ReplyIcon from '@mui/icons-material/Reply';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { makeStyles } from '@mui/styles';
import React from 'react';
import { timeConversion } from '../../utils';

const useRowStyles = makeStyles({
  root: {
    '& > *': {
      borderBottom: 'unset',
    },
  },
});

function Row(props) {
  console.log(props);
  const { row } = props;
  const [open, setOpen] = React.useState(false);
  const classes = useRowStyles();

  const replyMessage = (userId, subject) => {
    props.history.push({
      pathname: '/app/form/privateMessage',
      state: { data: { userId, subject } },
    });
  };

  const deleteMessage = () => {
    if (window.confirm('Are you sure you want to delete the message?')) {
      console.log('delete the entry here');
    }
  };

  return (
    <React.Fragment>
      <TableRow className={classes.root}>
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
          />
          {row.merchantUserId}
        </TableCell>
        <TableCell align="left">{row.orderId}</TableCell>
        <TableCell align="left">{row.passCode}</TableCell>
        <TableCell align="left">
          {row.delivery.pickupTime} {row.delivery.instruction}
        </TableCell>
        <TableCell align="left">{row.payment.method}</TableCell>
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
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box margin={1}>
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
                  {row.items.map((item) => (
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

export default function UserOrderList(props) {
  const { orders } = props;
  console.log('orders = ', orders);
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
          {props.orders.map((order, index) => (
            <Row history={props.history} key={index} row={order} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
