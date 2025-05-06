import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";

// MUI Imports
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
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";

import { useUserState } from "../../contexts/UserContext";
import useDebounce from "../../hooks/useDebounce.js";
import { apiPost } from "../../api/apiPost.js";

const useRowStyles = makeStyles((theme) => ({
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
    width: "90%",
    boxSizing: "border-box",
  },
  formControl: {
    minWidth: 100,
    width: "90%",
    "& .MuiInputBase-root": {
      fontSize: "inherit",
      padding: "0px 8px", // Adjust padding for Select
    },
    "& .MuiSelect-select": {
      paddingTop: "4px",
      paddingBottom: "4px",
    },
    "& .MuiInputLabel-root": {
      fontSize: "0.8rem", // Smaller label
      transform: "translate(10px, -8px) scale(0.75)", // Adjust label position
    },
  },
  iconButton: {
    cursor: "pointer",
    padding: "4px",
    "&:hover": {
      color: theme?.palette?.primary?.main || "blue",
    },
  },
}));

function RefRelationRow(props) {
  const navigate = useNavigate();
  const { row, onDeleteSuccess } = props;
  const classes = useRowStyles();

  const handleUpdate = (relationRow) => {
    console.log("Update Ref Relation Row:", relationRow);
    navigate("/app/form/updateRefRelation", {
      state: {
        data: { ...relationRow },
      },
    });
  };

  const handleDelete = async (relationRow) => {
    if (
      window.confirm(
        `Are you sure you want to delete this relation? (Relation ID: ${relationRow.relationId}, From: ${relationRow.valueIdFrom}, To: ${relationRow.valueIdTo})`,
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "ref",
        action: "deleteRefRelation", // <-- Action to delete relation
        version: "0.1.0",
        data: {
          // Primary key fields
          relationId: relationRow.relationId,
          valueIdFrom: relationRow.valueIdFrom,
          valueIdTo: relationRow.valueIdTo,
        },
      };
      console.log("Delete command:", cmd);

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });

      if (result && !result.error) {
        alert("RefRelation deleted successfully.");
        if (onDeleteSuccess) onDeleteSuccess();
      } else if (result && result.error) {
        console.error("API Error deleting RefRelation:", result.error);
        alert(
          `Error deleting RefRelation: ${result.error.description || result.error.message || "Unknown error"}`,
        );
      } else {
        console.error("Unexpected response from API during delete:", result);
        alert("An unexpected error occurred while deleting.");
      }
    }
  };

  const rowKey = `${row.relationId}-${row.valueIdFrom}-${row.valueIdTo}`;

  return (
    <TableRow className={classes.root} key={rowKey}>
      <TableCell align="left">{row.relationId}</TableCell>
      {/* Assuming relationName is fetched by the backend via JOIN */}
      <TableCell align="left">{row.relationName || "N/A"}</TableCell>
      <TableCell align="left">{row.valueIdFrom}</TableCell>
      {/* Assuming valueCodeFrom is fetched by the backend via JOIN */}
      <TableCell align="left">{row.valueCodeFrom || "N/A"}</TableCell>
      <TableCell align="left">{row.valueIdTo}</TableCell>
      {/* Assuming valueCodeTo is fetched by the backend via JOIN */}
      <TableCell align="left">{row.valueCodeTo || "N/A"}</TableCell>
      <TableCell align="left">{row.active ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Update Relation">
          <SystemUpdateIcon
            className={classes.iconButton}
            onClick={() => handleUpdate(row)}
          />
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Delete Relation">
          <DeleteForeverIcon
            className={classes.iconButton}
            onClick={() => handleDelete(row)}
          />
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

RefRelationRow.propTypes = {
  row: PropTypes.shape({
    relationId: PropTypes.string.isRequired,
    relationName: PropTypes.string, // Can be undefined if JOIN fails or not included
    valueIdFrom: PropTypes.string.isRequired,
    valueCodeFrom: PropTypes.string, // Can be undefined
    valueIdTo: PropTypes.string.isRequired,
    valueCodeTo: PropTypes.string, // Can be undefined
    active: PropTypes.bool.isRequired,
    updateUser: PropTypes.string.isRequired,
    updateTs: PropTypes.string.isRequired,
  }).isRequired,
  onDeleteSuccess: PropTypes.func,
};

function RefRelationList(props) {
  const { refRelations, onDeleteSuccess } = props;
  return (
    <TableBody>
      {refRelations && refRelations.length > 0 ? (
        refRelations.map((relationRow) => (
          <RefRelationRow
            key={`${relationRow.relationId}-${relationRow.valueIdFrom}-${relationRow.valueIdTo}`}
            row={relationRow}
            onDeleteSuccess={onDeleteSuccess}
          />
        ))
      ) : (
        <TableRow>
          {/* Adjust colSpan based on the number of columns in RefRelationRow */}
          <TableCell colSpan={11} align="center">
            No Reference Relations found matching your criteria.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RefRelationList.propTypes = {
  refRelations: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDeleteSuccess: PropTypes.func,
};

// --- Main RefRelation Component ---
export default function RefRelation() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { host } = useUserState();
  const location = useLocation();
  const data = location.state?.data;

  const [relationId, setRelationId] = useState(() => data?.relationId || "");
  const debouncedRelationId = useDebounce(relationId, 1000);
  const [relationName, setRelationName] = useState("");
  const debouncedRelationName = useDebounce(relationName, 1000);
  const [valueIdFrom, setValueIdFrom] = useState("");
  const debouncedValueIdFrom = useDebounce(valueIdFrom, 1000);
  const [valueCodeFrom, setValueCodeFrom] = useState("");
  const debouncedValueCodeFrom = useDebounce(valueCodeFrom, 1000);
  const [valueIdTo, setValueIdTo] = useState("");
  const debouncedValueIdTo = useDebounce(valueIdTo, 1000);
  const [valueCodeTo, setValueCodeTo] = useState("");
  const debouncedValueCodeTo = useDebounce(valueCodeTo, 1000);
  const [active, setActive] = useState(""); // Store as string "true", "false", or ""
  const debouncedActive = useDebounce(active, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [refRelations, setRefRelations] = useState([]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerDataRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Filter Input Handlers
  const handleRelationIdChange = (event) => setRelationId(event.target.value);
  const handleRelationNameChange = (event) =>
    setRelationName(event.target.value);
  const handleValueIdFromChange = (event) => setValueIdFrom(event.target.value);
  const handleValueCodeFromChange = (event) =>
    setValueCodeFrom(event.target.value);
  const handleValueIdToChange = (event) => setValueIdTo(event.target.value);
  const handleValueCodeToChange = (event) => setValueCodeTo(event.target.value);
  const handleActiveChange = (event) => setActive(event.target.value); // Value will be "true", "false", or ""

  const fetchData = useCallback(async (url, headers) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, { headers, credentials: "include" });
      const responseData = await response.json();

      if (!response.ok) {
        console.error("API Error Response:", responseData);
        setError(
          responseData.description ||
            responseData.message ||
            `HTTP error! status: ${response.status}`,
        );
        setRefRelations([]);
        setTotal(0);
      } else {
        console.log("API Success Response:", responseData);
        setRefRelations(responseData.relations || []); // Assuming API returns { refRelations: [], total: N }
        setTotal(responseData.total || 0);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
      setError(e.message || "An unexpected error occurred");
      setRefRelations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "ref",
      action: "getRefRelation",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        ...(debouncedRelationId && { relationId: debouncedRelationId }),
        ...(debouncedRelationName && { relationName: debouncedRelationName }),
        ...(debouncedValueIdFrom && { valueIdFrom: debouncedValueIdFrom }),
        ...(debouncedValueCodeFrom && {
          valueCodeFrom: debouncedValueCodeFrom,
        }),
        ...(debouncedValueIdTo && { valueIdTo: debouncedValueIdTo }),
        ...(debouncedValueCodeTo && { valueCodeTo: debouncedValueCodeTo }),
      },
    };
    // Handle boolean active filter
    if (debouncedActive === "true") {
      cmd.data.active = true;
    } else if (debouncedActive === "false") {
      cmd.data.active = false;
    }
    // If debouncedActive is "", don't send the active field (filter by all)

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedRelationId,
    debouncedRelationName,
    debouncedValueIdFrom,
    debouncedValueCodeFrom,
    debouncedValueIdTo,
    debouncedValueCodeTo,
    debouncedActive,
    fetchData,
    refreshTrigger,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    console.log("Navigate to create RefRelation page");
    navigate("/app/form/createRefRelation");
  };

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
        <h4>Error Fetching Reference Relations:</h4>
        <pre>
          {typeof error === "string" ? error : JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="reference relation table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Relation Id"
                    value={relationId}
                    onChange={handleRelationIdChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Relation Name"
                    value={relationName}
                    onChange={handleRelationNameChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Id From"
                    value={valueIdFrom}
                    onChange={handleValueIdFromChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Code From"
                    value={valueCodeFrom}
                    onChange={handleValueCodeFromChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Id To"
                    value={valueIdTo}
                    onChange={handleValueIdToChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Code To"
                    value={valueCodeTo}
                    onChange={handleValueCodeToChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left" style={{ minWidth: 120 }}>
                  <FormControl
                    variant="standard"
                    className={classes.formControl}
                  >
                    <InputLabel id="active-filter-label">Active</InputLabel>
                    <Select
                      labelId="active-filter-label"
                      value={active}
                      onChange={handleActiveChange}
                      label="Active"
                    >
                      <MenuItem value="">
                        <em>Any</em>
                      </MenuItem>
                      <MenuItem value="true">Yes</MenuItem>
                      <MenuItem value="false">No</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <RefRelationList
              refRelations={refRelations}
              onDeleteSuccess={triggerDataRefresh}
            />
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
        <Tooltip title="Add New Relation">
          <AddBoxIcon
            onClick={handleCreate}
            style={{ cursor: "pointer", margin: "10px", fontSize: "2rem" }}
          />
        </Tooltip>
      </div>
    );
  }

  return <div className="RefRelation">{content}</div>;
}
