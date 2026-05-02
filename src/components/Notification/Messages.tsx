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
import React, { useMemo } from "react";
import { Box } from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../../contexts/UserContext";
import TaskActionPanel from "../../tasks/TaskActionPanel";
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from "../../tasks/taskUtils";

function Row({ row }: { row: any }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskContext = useMemo(
    () => mergeTaskContext(
      contextFromSearchParams(searchParams),
      { userId: row.fromId, accountSection: "messages" },
    ),
    [row.fromId, searchParams],
  );

  const replyMessage = (userId: string, subject: string) => {
    navigate(buildTaskAwareRoute("/app/form/privateMessage", searchParams, taskContext), {
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
  const [searchParams] = useSearchParams();
  const { userId } = useUserState();
  const taskContext = useMemo(
    () => mergeTaskContext(
      contextFromSearchParams(searchParams),
      { userId: userId ?? "", accountSection: "messages" },
    ),
    [searchParams, userId],
  );
  const messages = (location.state as any)?.data || [];

  return (
    <Box>
      <h2>Private Messages</h2>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="Account Tasks"
          context={taskContext}
          taskIds={["manage-my-account"]}
          maxActions={1}
        />
      </Box>
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
    </Box>
  );
}
