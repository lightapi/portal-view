import { useState, useEffect, useCallback, ReactNode } from "react";
import useDebounce from "../../hooks/useDebounce";
import { useUserState } from "../../contexts/UserContext";
import fetchClient from "../../utils/fetchClient";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  CircularProgress,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Box,
  Typography,
} from "@mui/material";

interface NotificationData {
  userId: string;
  nonce: number;
  eventClass: string;
  processFlag: boolean;
  processTs: string | null;
  eventJson: string;
  error: string;
  hostId: string;
}

interface RowProps {
  row: NotificationData;
}

function Row({ row }: RowProps) {
  return (
    <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
      <TableCell align="left">{row.userId}</TableCell>
      <TableCell align="left">{row.nonce}</TableCell>
      <TableCell align="left">{row.eventClass}</TableCell>
      <TableCell align="left">{row.processFlag ? "Y" : "N"}</TableCell>
      <TableCell align="left">
        {row.processTs ? new Date(row.processTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="left">{row.eventJson}</TableCell>
      <TableCell align="left">{row.error}</TableCell>
    </TableRow>
  );
}

interface NotificationListProps {
  notifications: NotificationData[];
}

function NotificationList({ notifications }: NotificationListProps) {
  return (
    <TableBody>
      {notifications && notifications.length > 0 ? (
        notifications.map((notification, index) => (
          <Row key={index} row={notification} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={7} align="center">
            No notifications found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

export default function Notification() {
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [userId, setUserId] = useState("");
  const debouncedUserId = useDebounce(userId, 1000);
  const [nonce, setNonce] = useState("");
  const debouncedNonce = useDebounce(nonce, 1000);
  const [eventClass, setEventClass] = useState("");
  const debouncedEventClass = useDebounce(eventClass, 1000);
  const [processFlag, setProcessFlag] = useState(""); // "" for no selection, "Y" or "N"
  const [processTs, setProcessTs] = useState("");
  const debouncedProcessTs = useDebounce(processTs, 1000);
  const [eventJson, setEventJson] = useState("");
  const debouncedEventJson = useDebounce(eventJson, 1000);
  const [error, setError] = useState("");
  const debouncedError = useDebounce(error, 1000);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<any>();
  const [total, setTotal] = useState(0);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const handleUserIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserId(event.target.value);
  };
  const handleNonceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNonce(event.target.value);
  };
  const handleEventClassChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEventClass(event.target.value);
  };
  const handleProcessFlagChange = (event: any) => {
    setProcessFlag(event.target.value);
  };
  const handleProcessTsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProcessTs(event.target.value);
  };
  const handleEventJsonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEventJson(event.target.value);
  };
  const handleErrorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(event.target.value);
  };

  const fetchData = useCallback(async (url: string) => {
    try {
      setLoading(true);
      const data = await fetchClient(url);
      setNotifications(data.notifications);
      setTotal(data.total);
      setLoading(false);
    } catch (e) {
      console.log(e);
      setFetchError(e);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "user",
      action: "getNotification",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        userId: debouncedUserId,
        nonce: debouncedNonce,
        eventClass: debouncedEventClass,
        processFlag: processFlag,
        processTs: debouncedProcessTs,
        eventJson: debouncedEventJson,
        error: debouncedError,
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

    fetchData(url);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedUserId,
    debouncedNonce,
    debouncedEventClass,
    processFlag,
    debouncedProcessTs,
    debouncedEventJson,
    debouncedError,
    fetchData,
  ]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  let content: ReactNode;
  if (loading) {
    content = (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  } else if (fetchError) {
    content = (
      <Box sx={{ p: 3 }}>
        <Typography color="error">
          <pre>{JSON.stringify(fetchError, null, 2)}</pre>
        </Typography>
      </Box>
    );
  } else {
    content = (
      <Box>
        <TableContainer component={Paper}>
          <Table aria-label="notification table">
            <TableHead>
              <TableRow>
                <TableCell align="left">
                  <TextField
                    label="User ID"
                    variant="standard"
                    value={userId}
                    onChange={handleUserIdChange}
                    fullWidth
                  />
                </TableCell>
                <TableCell align="left">
                  <TextField
                    label="Nonce"
                    variant="standard"
                    value={nonce}
                    onChange={handleNonceChange}
                    fullWidth
                  />
                </TableCell>
                <TableCell align="left">
                  <TextField
                    label="Event Class"
                    variant="standard"
                    value={eventClass}
                    onChange={handleEventClassChange}
                    fullWidth
                  />
                </TableCell>
                <TableCell align="left">
                  <FormControl fullWidth variant="standard">
                    <InputLabel id="success-flag-label">
                      Success Flag
                    </InputLabel>
                    <Select
                      labelId="success-flag-label"
                      id="process-flag"
                      value={processFlag}
                      onChange={handleProcessFlagChange}
                      label="Success Flag"
                    >
                      <MenuItem value={""}></MenuItem>
                      <MenuItem value={"Y"}>Y</MenuItem>
                      <MenuItem value={"N"}>N</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="left">
                  <TextField
                    label="Process Timestamp"
                    variant="standard"
                    value={processTs}
                    onChange={handleProcessTsChange}
                    fullWidth
                  />
                </TableCell>
                <TableCell align="left">
                  <TextField
                    label="Event JSON"
                    variant="standard"
                    value={eventJson}
                    onChange={handleEventJsonChange}
                    fullWidth
                  />
                </TableCell>
                <TableCell align="left">
                  <TextField
                    label="Error"
                    variant="standard"
                    value={error}
                    onChange={handleErrorChange}
                    fullWidth
                  />
                </TableCell>
              </TableRow>
            </TableHead>
            <NotificationList notifications={notifications} />
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Box>
    );
  }

  return <Box className="App">{content}</Box>;
}

