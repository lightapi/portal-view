import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
  input: {
    fontSize: "inherit",
    padding: "4px 8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    width: "90%", // Adjust width as needed
    boxSizing: "border-box", // Include padding and border in the element's total width and height
  },
  iconButton: {
    cursor: "pointer",
    padding: "4px",
    "&:hover": {
      color: "primary.main", // Use theme color if available
    },
  },
});

// --- Row Component for Schedule ---
function ScheduleRow(props) {
  const navigate = useNavigate();
  const { row, onDataRefresh } = props;
  const classes = useRowStyles();

  const handleUpdate = (schedule) => {
    navigate("/app/form/updateSchedule", {
      // Adjust path as needed
      state: { data: { ...schedule } }, // Pass schedule data to update form
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        `Are you sure you want to delete schedule "${row.scheduleName}" (${row.scheduleId})?`,
      )
    ) {
      const cmd = {
        host: "lightapi.net", // Adjust if needed
        service: "schedule", // Service name
        action: "deleteSchedule", // Delete action
        version: "0.1.0", // Adjust version if needed
        data: {
          // Send identifying data
          scheduleId: row.scheduleId,
          // hostId might be needed for backend permission checks
          hostId: row.hostId,
        },
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });
      if (result.data) {
        alert("Schedule deleted successfully.");
        onDataRefresh(); // Trigger data refresh in parent
      } else if (result.error) {
        console.error("API Error deleting schedule:", result.error);
        alert(
          `Error deleting schedule: ${result.error.description || result.error.message || "Unknown error"}`,
        );
      }
    }
  };

  // Helper to truncate event data for display
  const truncateData = (data, maxLength = 50) => {
    if (!data) return "";
    if (data.length <= maxLength) return data;
    return data.substring(0, maxLength) + "...";
  };

  return (
    <TableRow className={classes.root} key={row.scheduleId}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left" component="th" scope="row">
        {row.scheduleId}
      </TableCell>
      <TableCell align="left">{row.scheduleName}</TableCell>
      <TableCell align="left">{row.frequencyUnit}</TableCell>
      <TableCell align="right">{row.frequencyTime}</TableCell>{" "}
      {/* Align numbers right */}
      <TableCell align="left">
        {row.startTs ? new Date(row.startTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="left">{row.eventTopic}</TableCell>
      <TableCell align="left">{row.eventType}</TableCell>
      <TableCell
        align="left"
        style={{
          maxWidth: 150,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <Tooltip title={row.eventData || ""}>
          <span>{truncateData(row.eventData)}</span>
        </Tooltip>
      </TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <SystemUpdateIcon
          className={classes.iconButton}
          onClick={() => handleUpdate(row)}
        />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon
          className={classes.iconButton}
          onClick={() => handleDelete(row)}
        />
      </TableCell>
    </TableRow>
  );
}

// PropTypes validation for ScheduleRow
ScheduleRow.propTypes = {
  row: PropTypes.shape({
    scheduleId: PropTypes.string.isRequired,
    hostId: PropTypes.string.isRequired,
    scheduleName: PropTypes.string.isRequired,
    frequencyUnit: PropTypes.string.isRequired,
    frequencyTime: PropTypes.number.isRequired,
    startTs: PropTypes.string, // Keep as string, formatted in render
    eventTopic: PropTypes.string.isRequired,
    eventType: PropTypes.string.isRequired,
    eventData: PropTypes.string.isRequired, // Assuming TEXT -> String
    updateUser: PropTypes.string,
    updateTs: PropTypes.string, // Keep as string, formatted in render
  }).isRequired,
  onDataRefresh: PropTypes.func.isRequired, // Function to trigger data refresh
};

// --- List Component ---
function ScheduleList(props) {
  const { schedules, onDataRefresh } = props;
  return (
    <TableBody>
      {schedules && schedules.length > 0 ? (
        schedules.map((schedule) => (
          <ScheduleRow
            key={schedule.scheduleId}
            row={schedule}
            onDataRefresh={onDataRefresh}
          />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={13} align="center">
            {" "}
            {/* Adjusted colSpan */}
            No schedules found matching your criteria.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ScheduleList.propTypes = {
  schedules: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDataRefresh: PropTypes.func.isRequired,
};

// --- Main Schedule Component ---
export default function ScheduleAdmin() {
  // Renamed component
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState(); // Use host from context for default filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Filter states
  const [scheduleId, setScheduleId] = useState("");
  const debouncedScheduleId = useDebounce(scheduleId, 1000);
  const [scheduleName, setScheduleName] = useState("");
  const debouncedScheduleName = useDebounce(scheduleName, 1000);
  const [frequencyUnit, setFrequencyUnit] = useState("");
  const debouncedFrequencyUnit = useDebounce(frequencyUnit, 1000);
  const [eventTopic, setEventTopic] = useState("");
  const debouncedEventTopic = useDebounce(eventTopic, 1000);
  const [eventType, setEventType] = useState("");
  const debouncedEventType = useDebounce(eventType, 1000);
  const [frequencyTime, setFrequencyTime] = useState("");
  const debouncedFrequencyTime = useDebounce(frequencyTime, 1000);

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [schedules, setSchedules] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // State to trigger refresh

  // Filter change handlers
  const handleScheduleIdChange = (event) => setScheduleId(event.target.value);
  const handleScheduleNameChange = (event) =>
    setScheduleName(event.target.value);
  const handleFrequencyUnitChange = (event) =>
    setFrequencyUnit(event.target.value);
  const handleEventTopicChange = (event) => setEventTopic(event.target.value);
  const handleEventTypeChange = (event) => setEventType(event.target.value);
  const handleFrequencyTimeChange = (event) =>
    setFrequencyTime(event.target.value);

  // Data fetching function (reusable callback)
  const fetchData = useCallback(async (apiUrl, apiHeaders) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiUrl, {
        headers: apiHeaders,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("Fetch error:", error);
        setError(error.description);
        setSchedules([]);
        setTotal(0);
      } else {
        const data = await response.json();
        console.log("Fetched schedules:", data);
        setSchedules(data.schedules || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Network or other error:", e);
      setError({ message: e.message || "Failed to fetch data" });
      setSchedules([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  // Effect to fetch data when filters or pagination change
  useEffect(() => {
    const queryData = {
      hostId: host,
      offset: page * rowsPerPage,
      limit: rowsPerPage,
      // Conditionally add filters only if they have a non-empty value
      ...(debouncedScheduleId && { scheduleId: debouncedScheduleId }),
      ...(debouncedScheduleName && { scheduleName: debouncedScheduleName }),
      ...(debouncedFrequencyUnit && { frequencyUnit: debouncedFrequencyUnit }),
      ...(debouncedFrequencyTime && {
        frequencyTime: parseInt(debouncedFrequencyTime, 10),
      }),
      ...(debouncedEventTopic && { eventTopic: debouncedEventTopic }),
      ...(debouncedEventType && { eventType: debouncedEventType }),
    };

    const cmd = {
      host: "lightapi.net", // Adjust if needed
      service: "schedule", // Service name for schedules
      action: "getSchedule", // Action name
      version: "0.1.0", // Adjust version if needed
      data: queryData,
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") }; // Adjust CSRF if needed

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedScheduleId,
    debouncedScheduleName,
    debouncedFrequencyUnit,
    debouncedFrequencyTime,
    debouncedEventTopic,
    debouncedEventType,
    fetchData,
    refreshTrigger,
  ]);

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  // Create handler
  const handleCreate = () => {
    navigate("/app/form/createSchedule");
  };

  // Refresh handler
  const handleDataRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Render logic
  let content;
  if (loading) {
    content = (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "20px" }}
      >
        <CircularProgress />
      </div>
    );
  } else if (error) {
    content = (
      <div style={{ color: "red", padding: "20px" }}>
        <h4>Error Fetching Schedules:</h4>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table stickyHeader aria-label="schedule table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Schedule ID"
                    value={scheduleId}
                    onChange={handleScheduleIdChange}
                    className={classes.input}
                    style={{ width: "180px" }} // Adjust width
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Schedule Name"
                    value={scheduleName}
                    onChange={handleScheduleNameChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Freq Unit"
                    value={frequencyUnit}
                    onChange={handleFrequencyUnitChange}
                    className={classes.input}
                    style={{ width: "100px" }}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Freq Time"
                    value={frequencyTime}
                    onChange={handleFrequencyTimeChange}
                    className={classes.input}
                    style={{ width: "100px" }}
                  />
                </TableCell>
                <TableCell align="left">Start Time</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Event Topic"
                    value={eventTopic}
                    onChange={handleEventTopicChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Event Type"
                    value={eventType}
                    onChange={handleEventTypeChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">Event Data</TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ScheduleList
              schedules={schedules}
              onDataRefresh={handleDataRefresh}
            />
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
        <Tooltip title="Create New Schedule">
          <AddBoxIcon
            className={classes.iconButton}
            onClick={handleCreate}
            style={{ margin: "10px", fontSize: "30px" }}
          />
        </Tooltip>
      </div>
    );
  }

  return <div className="ScheduleAdmin">{content}</div>;
}
