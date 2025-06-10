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
import DataObjectIcon from "@mui/icons-material/DataObject";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js";
import { stringToBoolean } from "../../utils/index.jsx";

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
    width: "90%",
    boxSizing: "border-box",
  },
  iconButton: {
    cursor: "pointer",
    padding: "4px",
    "&:hover": {
      color: "primary.main",
    },
  },
});

// --- Row Component for RefTable ---
function RefTableRow(props) {
  const navigate = useNavigate();
  const { row, onDataRefresh } = props;
  const classes = useRowStyles();

  const handleUpdate = (refTable) => {
    navigate("/app/form/updateRefTable", {
      state: { data: { ...refTable } },
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        `Are you sure you want to delete refTable "${row.tableId}" (${row.tableName})?`,
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "ref",
        action: "deleteRefTable",
        version: "0.1.0",
        data: {
          tableId: row.tableId,
          hostId: row.hostId,
        },
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });
      if (result.data) {
        alert("RefTable deleted successfully.");
        onDataRefresh();
      } else if (result.error) {
        console.error("API Error deleting RefTable:", result.error);
        alert(
          `Error deleting RefTable: ${result.error.description || result.error.message || "Unknown error"}`,
        );
      }
    }
  };

  const handleRefValue = (tableId) => {
    navigate("/app/ref/value", {
      state: { data: { tableId } },
    });
  };

  return (
    <TableRow className={classes.root} key={row.tableId}>
      <TableCell align="left">{row.hostId ? row.hostId : "N/A"}</TableCell>
      <TableCell align="left">{row.tableId}</TableCell>
      <TableCell align="left">{row.tableName}</TableCell>
      <TableCell align="left">{row.tableDesc}</TableCell>
      <TableCell align="left">{row.active}</TableCell>
      <TableCell align="left">{row.editable}</TableCell>
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
      <TableCell align="right">
        <DataObjectIcon
          className={classes.iconButton}
          onClick={() => handleRefValue(row.tableId)}
        />
      </TableCell>
    </TableRow>
  );
}

RefTableRow.propTypes = {
  row: PropTypes.shape({
    tableId: PropTypes.string.isRequired,
    hostId: PropTypes.string,
    tableName: PropTypes.string.isRequired,
    tableDesc: PropTypes.string.isRequired,
    active: PropTypes.bool.isRequired,
    editable: PropTypes.bool.isRequired,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
  onDataRefresh: PropTypes.func.isRequired,
};

// --- List Component ---
function RefTableList(props) {
  const { RefTables, onDataRefresh } = props;
  return (
    <TableBody>
      {RefTables && RefTables.length > 0 ? (
        RefTables.map((RefTable) => (
          <RefTableRow
            key={RefTable.tableId}
            row={RefTable}
            onDataRefresh={onDataRefresh}
          />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={13} align="center">
            {" "}
            {/* Adjusted colSpan */}
            No RefTables found matching your criteria.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RefTableList.propTypes = {
  RefTables: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDataRefresh: PropTypes.func.isRequired,
};

// --- Main RefTable Component ---
export default function RefTableAdmin() {
  // Renamed component
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Filter states
  const [tableId, setTableId] = useState("");
  const debouncedTableId = useDebounce(tableId, 1000);
  const [tableName, setTableName] = useState("");
  const debouncedTableName = useDebounce(tableName, 1000);
  const [tableDesc, setTableDesc] = useState("");
  const debouncedTableDesc = useDebounce(tableDesc, 1000);
  const [active, setActive] = useState("");
  const debouncedActive = useDebounce(active, 1000);
  const [editable, setEditable] = useState("");
  const debouncedEditable = useDebounce(editable, 1000);

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [RefTables, setRefTables] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // State to trigger refresh

  // Filter change handlers
  const handleTableIdChange = (event) => setTableId(event.target.value);
  const handleTableNameChange = (event) => setTableName(event.target.value);
  const handleTableDescChange = (event) => setTableDesc(event.target.value);
  const handleActiveChange = (event) => setActive(event.target.value);
  const handleEditableChange = (event) => setEditable(event.target.value);

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
        setRefTables([]);
        setTotal(0);
      } else {
        const data = await response.json();
        console.log("Fetched RefTables:", data);
        setRefTables(data.refTables || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Network or other error:", e);
      setError({ message: e.message || "Failed to fetch data" });
      setRefTables([]);
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
      tableId: debouncedTableId,
      tableName: debouncedTableName,
      tableDesc: debouncedTableDesc,
      ...(debouncedActive && debouncedActive.trim() !== ""
        ? { active: stringToBoolean(debouncedActive) }
        : {}),
      ...(debouncedEditable && debouncedEditable.trim() !== ""
        ? { editable: stringToBoolean(debouncedEditable) }
        : {}),
    };

    const cmd = {
      host: "lightapi.net",
      service: "ref",
      action: "getRefTable",
      version: "0.1.0",
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
    debouncedTableId,
    debouncedTableName,
    debouncedTableDesc,
    debouncedActive,
    debouncedEditable,
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

  const handleCreate = () => {
    navigate("/app/form/createRefTable");
  };

  const handleDataRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
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
        <h4>Error Fetching RefTables:</h4>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table stickyHeader aria-label="RefTable table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Host Id"
                    value={host}
                    className={classes.input}
                    style={{ width: "180px" }}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Table Id"
                    value={tableId}
                    onChange={handleTableIdChange}
                    className={classes.input}
                    style={{ width: "180px" }}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Table Name"
                    value={tableName}
                    onChange={handleTableNameChange}
                    className={classes.input}
                    style={{ width: "180px" }}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Table Desc"
                    value={tableDesc}
                    onChange={handleTableDescChange}
                    className={classes.input}
                    style={{ width: "180px" }}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Active"
                    value={active}
                    onChange={handleActiveChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Editable"
                    value={editable}
                    onChange={handleEditableChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Ref Value</TableCell>
              </TableRow>
            </TableHead>
            <RefTableList
              RefTables={RefTables}
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
        <Tooltip title="Create New RefTable">
          <AddBoxIcon
            className={classes.iconButton}
            onClick={handleCreate}
            style={{ margin: "10px", fontSize: "30px" }}
          />
        </Tooltip>
      </div>
    );
  }

  return <div className="RefTableAdmin">{content}</div>;
}
