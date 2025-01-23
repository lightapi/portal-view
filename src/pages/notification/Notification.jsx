import { useState, useEffect, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce";
import { useUserState } from "../../contexts/UserContext";
import Cookies from "universal-cookie";
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
} from "@mui/material";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const { row } = props;
  const classes = useRowStyles();

  return (
    <TableRow className={classes.root}>
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

Row.propTypes = {
  row: PropTypes.shape({
    userId: PropTypes.string,
    nonce: PropTypes.number,
    eventClass: PropTypes.string,
    processFlag: PropTypes.bool,
    processTs: PropTypes.string,
    eventJson: PropTypes.string,
    error: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function NotificationList(props) {
  const { notifications } = props;
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

NotificationList.propTypes = {
  notifications: PropTypes.arrayOf(PropTypes.object).isRequired,
};

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
  const [fetchError, setFetchError] = useState();
  const [total, setTotal] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const handleUserIdChange = (event) => {
    setUserId(event.target.value);
  };
  const handleNonceChange = (event) => {
    setNonce(event.target.value);
  };
  const handleEventClassChange = (event) => {
    setEventClass(event.target.value);
  };
  const handleProcessFlagChange = (event) => {
    setProcessFlag(event.target.value);
  };
  const handleProcessTsChange = (event) => {
    setProcessTs(event.target.value);
  };
  const handleEventJsonChange = (event) => {
    setEventJson(event.target.value);
  };
  const handleErrorChange = (event) => {
    setError(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setFetchError(error.description);
        setNotifications([]);
      } else {
        const data = await response.json();
        setNotifications(data.notifications);
        setTotal(data.total);
      }
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
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

    fetchData(url, headers);
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

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  let content;
  if (loading) {
    content = (
      <div>
        <CircularProgress />
      </div>
    );
  } else if (fetchError) {
    content = (
      <div>
        <pre>{JSON.stringify(fetchError, null, 2)}</pre>
      </div>
    );
  } else {
    content = (
      <div>
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
      </div>
    );
  }

  return <div className="App">{content}</div>;
}
