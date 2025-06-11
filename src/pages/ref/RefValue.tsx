import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";

// MUI Imports (keep relevant ones)
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
import LanguageIcon from "@mui/icons-material/Language";
import Tooltip from "@mui/material/Tooltip";
import { useUserState } from "../../contexts/UserContext";
import useDebounce from "../../hooks/useDebounce.js";
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

function RefValueRow(props) {
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (valueRow) => {
    console.log("Update Ref Value Row:", valueRow);
    navigate("/app/form/updateRefValue", {
      state: {
        data: { ...valueRow },
      },
    });
  };

  const handleDelete = async (row) => {
    // *** Adjust confirmation message for values ***
    if (
      window.confirm(
        `Are you sure you want to delete this value? (valueCode: ${row.valueCode})`,
      )
    ) {
      // *** Construct command for deleting a value ***
      const cmd = {
        host: "lightapi.net",
        service: "ref",
        action: "deleteRefValue",
        version: "0.1.0",
        data: {
          valueId: row.valueId,
        },
      };
      console.log("Delete command:", cmd);

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });
      if (result.data) {
        alert("RefValue deleted successfully.");
      } else if (result.error) {
        console.error("API Error deleting RefValue:", result.error);
        alert(
          `Error deleting RefValue: ${result.error.description || result.error.message || "Unknown error"}`,
        );
      }
    }
  };

  const handleLocale = (valueId) => {
    navigate("/app/ref/locale", {
      state: { data: { valueId } },
    });
  };

  const truncateData = (data, maxLength = 50) => {
    if (!data) return "";
    if (data.length <= maxLength) return data;
    return data.substring(0, maxLength) + "...";
  };

  return (
    <TableRow className={classes.root} key={row.valueId}>
      <TableCell align="left">{row.valueId}</TableCell>
      <TableCell align="left">{row.tableId}</TableCell>
      <TableCell align="left">{row.tableName}</TableCell>
      <TableCell align="left">{row.valueCode}</TableCell>
      <TableCell
        align="left"
        style={{
          maxWidth: 150,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <Tooltip title={row.valueDesc || ""}>
          <span>{truncateData(row.valueDesc)}</span>
        </Tooltip>
      </TableCell>
      <TableCell align="left">{row.active ? "Yes" : "No"}</TableCell>
      <TableCell align="left">
        {row.startTs ? new Date(row.startTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="left">
        {row.endTs ? new Date(row.endTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="left">{row.displayOrder}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Update Value">
          <SystemUpdateIcon
            className={classes.iconButton}
            onClick={() => handleUpdate(row)}
          />
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Delete Value">
          <DeleteForeverIcon
            className={classes.iconButton}
            onClick={() => handleDelete(row)}
          />
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Value Locale">
          <LanguageIcon
            className={classes.iconButton}
            onClick={() => handleLocale(row.valueId)}
          />
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

RefValueRow.propTypes = {
  row: PropTypes.shape({
    tableId: PropTypes.string.isRequired,
    tableName: PropTypes.string.isRequired,
    valueId: PropTypes.string.isRequired,
    displayOrder: PropTypes.integer,
    valueCode: PropTypes.string.isRequired,
    valueDesc: PropTypes.string,
    active: PropTypes.bool.isRequired,
    startTs: PropTypes.string,
    endTs: PropTypes.string,
    updateUser: PropTypes.string.isRequired,
    updateTs: PropTypes.string.isRequired,
  }),
};

function RefValueList(props) {
  const { refValues } = props;
  return (
    <TableBody>
      {refValues && refValues.length > 0 ? (
        refValues.map((valueRow) => (
          <RefValueRow key={valueRow.valueId} row={valueRow} />
        ))
      ) : (
        <TableRow>
          {/* *** Adjust colSpan based on the number of columns in RefValueRow *** */}
          <TableCell colSpan={8} align="center">
            No Reference Values found for this table or matching your criteria.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RefValueList.propTypes = {
  refValues: PropTypes.arrayOf(PropTypes.object).isRequired,
};

// --- Main RefValue Component ---
export default function RefValue() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { host } = useUserState();
  const location = useLocation();
  const data = location.state?.data;

  const [tableId, setTableId] = useState(() => data?.tableId || "");
  const debouncedTableId = useDebounce(tableId, 1000);
  const [valueId, setValueId] = useState("");
  const debouncedValueId = useDebounce(valueId, 1000);
  const [valueCode, setValueCode] = useState("");
  const debouncedValueCode = useDebounce(valueCode, 1000);
  const [valueDesc, setValueDesc] = useState("");
  const debouncedValueDesc = useDebounce(valueDesc, 1000);
  const [displayOrder, setDisplayOrder] = useState("");
  const debouncedDisplayOrder = useDebounce(displayOrder, 1000);
  const [active, setActive] = useState("");
  const debouncedActive = useDebounce(active, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [refValues, setRefValues] = useState([]); // State for values

  const handleValueIdChange = (event) => setValueId(event.target.value);
  const handleTableIdChange = (event) => setTableId(event.target.value);
  const handleValueCodeChange = (event) => setValueCode(event.target.value);
  const handleValueDescChange = (event) => setValueDesc(event.target.value);
  const handleDisplayOrderChange = (event) =>
    setDisplayOrder(event.target.value);
  const handleActiveChange = (event) => setActive(event.target.value);

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setRefValues([]);
      } else {
        const data = await response.json();
        console.log("data = ", data);
        setRefValues(data.refValues || []);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setRefValues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "ref",
      action: "getRefValue",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        valueId: debouncedValueId,
        tableId: debouncedTableId,
        valueCode: debouncedValueCode,
        valueDesc: debouncedValueDesc,
        ...(debouncedDisplayOrder && {
          displayOrder: parseInt(debouncedDisplayOrder, 10),
        }),
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
    debouncedValueId,
    debouncedTableId,
    debouncedValueCode,
    debouncedValueDesc,
    debouncedActive,
    debouncedDisplayOrder,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = (tableId) => {
    console.log("Create new value for table:", tableId);
    navigate("/app/form/createRefValue", {
      state: { data: { tableId } },
    });
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
        <h4>Error Fetching Reference Values:</h4>
        <pre>
          {typeof error === "string" ? error : JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="instance app table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Id"
                    value={valueId}
                    onChange={handleValueIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Table Id"
                    value={tableId}
                    onChange={handleTableIdChange}
                  />
                </TableCell>
                <TableCell align="left">Table Name</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Code"
                    value={valueCode}
                    onChange={handleValueCodeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Desc"
                    value={valueDesc}
                    onChange={handleValueDescChange}
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
                <TableCell align="left">Start Ts</TableCell>
                <TableCell align="left">End Ts</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Display Order"
                    value={displayOrder}
                    onChange={handleDisplayOrderChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Locale</TableCell>
              </TableRow>
            </TableHead>
            <RefValueList refValues={refValues} />
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
        <AddBoxIcon onClick={() => handleCreate(tableId)} />
      </div>
    );
  }

  return <div className="RefValue">{content}</div>;
}
