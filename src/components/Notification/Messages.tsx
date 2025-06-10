import DeleteIcon from '@mui/icons-material/Delete';
import ReplyIcon from '@mui/icons-material/Reply';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
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
        <TableCell component="th" scope="row">
          {timeConversion(new Date().getTime() - row.timestamp)}
        </TableCell>
        <TableCell align="left">
          <ReplyIcon onClick={() => replyMessage(row.fromId, row.subject)} />
          {row.fromId}
        </TableCell>
        <TableCell align="left">{row.subject}</TableCell>
        <TableCell align="right">
          <DeleteIcon
            onClick={() =>
              console.log('delete is clicked', row.timestamp, row.fromId)
            }
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
          {row.content}
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
}

export default function Messages(props) {
  console.log('props = ', props);
  console.log('data = ', props.location.state.data);
  const messages = props.location.state.data;
  return (
    <div>
      <h2>Private Messages</h2>
      <TableContainer component={Paper}>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell align="left">From</TableCell>
              <TableCell align="left">Subject</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {messages.map((msg, index) => (
              <Row history={props.history} key={index} row={msg} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
