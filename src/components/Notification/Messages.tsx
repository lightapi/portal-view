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
import { timeConversion } from "../../utils";
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Row({ row }: { row: any }) {
  const navigate = useNavigate();

  const replyMessage = (userId: string, subject: string) => {
    navigate("/app/form/privateMessage", {
      state: { data: { userId, subject } },
    });
  };

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell component="th" scope="row">
          {timeConversion(new Date().getTime() - row.timestamp)}
        </TableCell>
        <TableCell align="left">
          <ReplyIcon
            onClick={() => replyMessage(row.fromId, row.subject)}
            sx={{ cursor: "pointer", marginRight: 1 }}
          />
          {row.fromId}
        </TableCell>
        <TableCell align="left">{row.subject}</TableCell>
        <TableCell align="right">
          <DeleteIcon
            onClick={() =>
              console.log("delete is clicked", row.timestamp, row.fromId)
            }
            sx={{ cursor: "pointer" }}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
          {row.content}
        </TableCell>
      </TableRow>
    </>
  );
}

export default function Messages() {
  const location = useLocation();
  const messages = (location.state as any)?.data || [];

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
            {messages.map((msg: any, index: number) => (
              <Row key={index} row={msg} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
