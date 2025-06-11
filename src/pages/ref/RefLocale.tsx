import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";

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

function RefLocaleRow(props) {
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (localeRow) => {
    console.log("Update Ref Locale Row:", localeRow);
    navigate("/app/form/updateRefLocale", {
      state: {
        data: { ...localeRow },
      },
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        `Are you sure you want to delete this locale? (valueId: ${row.valueId}, language: ${row.language})`,
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "ref",
        action: "deleteRefLocale",
        version: "0.1.0",
        data: {
          valueId: row.valueId,
          language: row.language,
        },
      };
      console.log("Delete command:", cmd);

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });

      if (result.data) {
        // Check if deletion was successful (API might return empty data on success)
        alert("RefLocale deleted successfully.");
        // Optionally trigger a refresh of the data list here if needed
        // props.onDeleteSuccess(); // Example: Call a function passed down from parent
      } else if (result.error) {
        console.error("API Error deleting RefLocale:", result.error);
        alert(
          `Error deleting RefLocale: ${result.error.description || result.error.message || "Unknown error"}`,
        );
      } else {
        // Assume success if no error and potentially no data returned
        alert("RefLocale deleted successfully.");
        // props.onDeleteSuccess();
      }
    }
  };

  const truncateData = (data, maxLength = 50) => {
    if (!data) return "";
    if (data.length <= maxLength) return data;
    return data.substring(0, maxLength) + "...";
  };

  // Create a unique key for the row
  const rowKey = `${row.valueId}-${row.language}`;

  return (
    <TableRow className={classes.root} key={rowKey}>
      <TableCell align="left">{row.valueId}</TableCell>
      <TableCell align="left">{row.valueCode}</TableCell>
      <TableCell align="left">{row.valueDesc}</TableCell>
      <TableCell align="left">{row.language}</TableCell>
      <TableCell
        align="left"
        style={{
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <Tooltip title={row.valueLabel || ""}>
          <span>{truncateData(row.valueLabel)}</span>
        </Tooltip>
      </TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Update Locale">
          <SystemUpdateIcon
            className={classes.iconButton}
            onClick={() => handleUpdate(row)}
          />
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Delete Locale">
          <DeleteForeverIcon
            className={classes.iconButton}
            onClick={() => handleDelete(row)}
          />
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

RefLocaleRow.propTypes = {
  row: PropTypes.shape({
    valueId: PropTypes.string.isRequired,
    valueCode: PropTypes.string.isRequired,
    valueDesc: PropTypes.string,
    language: PropTypes.string.isRequired,
    valueLabel: PropTypes.string.isRequired,
    updateUser: PropTypes.string.isRequired,
    updateTs: PropTypes.string.isRequired,
  }).isRequired,
};

function RefLocaleList(props) {
  const { refLocales } = props; // <-- Changed prop name
  return (
    <TableBody>
      {refLocales && refLocales.length > 0 ? (
        refLocales.map((localeRow) => (
          <RefLocaleRow
            key={`${localeRow.valueId}-${localeRow.language}`} // <-- Composite key
            row={localeRow}
            // onDeleteSuccess={props.onDeleteSuccess} // Pass down if needed
          />
        ))
      ) : (
        <TableRow>
          {/* Adjust colSpan based on the number of columns in RefLocaleRow */}
          <TableCell colSpan={7} align="center">
            No Reference Locales found for this value or matching your criteria.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RefLocaleList.propTypes = {
  refLocales: PropTypes.arrayOf(PropTypes.object).isRequired, // <-- Changed prop name
  // onDeleteSuccess: PropTypes.func, // Pass down if needed
};

// --- Main RefLocale Component ---
export default function RefLocale() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation(); // Get state passed from RefValue page
  const data = location.state?.data; // Contains { valueId: '...' }

  // Ensure we have the valueId from the navigation state
  const initialValueId = data?.valueId || "";
  if (!initialValueId) {
    // Handle case where valueId is missing - perhaps redirect back or show error
    // For now, log an error and potentially show a message
    console.error("RefLocale page loaded without a valueId in location state.");
    // return <div>Error: Missing required valueId. Please navigate from a Reference Value.</div>;
  }

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { host } = useUserState(); // Assuming host is still needed for API calls

  // Filter State
  const [valueId, setValueId] = useState(initialValueId); // Initialize with passed valueId
  const debouncedValueId = useDebounce(valueId, 1000);

  const [valueCode, setValueCode] = useState("");
  const debouncedValueCode = useDebounce(valueCode, 1000);
  const [valueDesc, setValueDesc] = useState("");
  const debouncedValueDesc = useDebounce(valueDesc, 1000);

  const [language, setLanguage] = useState("");
  const debouncedLanguage = useDebounce(language, 1000);
  const [valueLabel, setValueLabel] = useState("");
  const debouncedValueLabel = useDebounce(valueLabel, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [refLocales, setRefLocales] = useState([]); // State for locales

  // Filter Input Handlers
  // Note: We might want to disable editing valueId if it's fixed context
  const handleValueIdChange = (event) => setValueId(event.target.value);
  const handleValueCodeChange = (event) => setValueCode(event.target.value);
  const handleValueDescChange = (event) => setValueDesc(event.target.value);
  const handleLanguageChange = (event) => setLanguage(event.target.value);
  const handleValueLabelChange = (event) => setValueLabel(event.target.value);

  const fetchData = useCallback(async (url, headers) => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      // Using fetch directly as in the original example
      const response = await fetch(url, { headers, credentials: "include" }); // Assuming credentials needed
      const responseData = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        console.error("API Error Response:", responseData);
        setError(
          responseData.description ||
            responseData.message ||
            `HTTP error! status: ${response.status}`,
        );
        setRefLocales([]);
        setTotal(0);
      } else {
        console.log("API Success Response:", responseData);
        setRefLocales(responseData.locales || []);
        setTotal(responseData.total || 0);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
      setError(e.message || "An unexpected error occurred");
      setRefLocales([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed for the function itself, only for its call in useEffect

  useEffect(() => {
    // Construct the command based on getRefLocaleRequest spec
    const cmd = {
      host: "lightapi.net",
      service: "ref",
      action: "getRefLocale", // <-- Correct action
      version: "0.1.0", // Use appropriate version
      data: {
        hostId: host, // Assuming hostId is needed by the backend query
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        // Include filters only if they have values (or send initial valueId)
        ...(debouncedValueId && { valueId: debouncedValueId }),
        ...(debouncedValueCode && { valueCode: debouncedValueCode }),
        ...(debouncedValueDesc && { valueDesc: debouncedValueDesc }),
        ...(debouncedLanguage && { language: debouncedLanguage }),
        ...(debouncedValueLabel && { valueLabel: debouncedValueLabel }),
      },
    };

    // Ensure valueId from context is included if not filtered explicitly
    // If the filter input is cleared, we might want to revert to the initial one,
    // or allow fetching all locales if the API supports it (which might not be desired).
    // Here, we prioritize the debounced filter value. If it's empty, valueId might not be sent.
    // Let's ensure the initial valueId is always sent if the filter is empty.
    if (!cmd.data.valueId && initialValueId) {
      cmd.data.valueId = initialValueId;
    }

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") }; // Standard CSRF header

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedValueId,
    debouncedValueCode,
    debouncedValueDesc,
    debouncedLanguage,
    debouncedValueLabel,
    fetchData,
    initialValueId,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0); // Reset to first page when rows per page changes
  };

  const handleCreate = () => {
    console.log("Create new locale for value:", initialValueId);
    // Navigate to the createRefLocale form, passing the valueId
    navigate("/app/form/createRefLocale", {
      state: { data: { valueId: initialValueId } }, // Pass required valueId
    });
  };

  // Callback function for potential refresh after delete
  // const handleDeletionSuccess = () => {
  //   // Re-fetch data by slightly modifying a dependency (e.g., page or a dummy state)
  //   // Or, more simply, refetch directly (though this bypasses the debounce/useEffect logic)
  //    const cmd = { /* ... construct cmd again ... */ };
  //    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  //    const cookies = new Cookies();
  //    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
  //    fetchData(url, headers);
  // };

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
        <h4>Error Fetching Reference Locales:</h4>
        <pre>{error}</pre>
      </div>
    );
  } else {
    content = (
      <div>
        {/* Optional: Display the parent Value ID prominently */}
        <h4>Locales for Value ID: {initialValueId}</h4>
        <TableContainer component={Paper}>
          <Table aria-label="reference locale table">
            <TableHead>
              <TableRow className={classes.root}>
                {/* Keep valueId filterable or display read-only? Filterable for consistency */}
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Id"
                    value={valueId}
                    onChange={handleValueIdChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Code"
                    value={valueCode}
                    onChange={handleValueCodeChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Desc"
                    value={valueDesc}
                    onChange={handleValueDescChange}
                    className={classes.input}
                  />
                </TableCell>

                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Language (e.g., en)"
                    value={language}
                    onChange={handleLanguageChange}
                    className={classes.input}
                    maxLength="2" // Enforce language code length
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Label"
                    value={valueLabel}
                    onChange={handleValueLabelChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            {/* Pass refLocales and potentially the delete callback */}
            <RefLocaleList
              refLocales={refLocales}
              // onDeleteSuccess={handleDeletionSuccess}
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
        {/* Add button - triggers handleCreate which uses initialValueId */}
        <Tooltip title="Add New Locale">
          <AddBoxIcon
            onClick={handleCreate}
            style={{ cursor: "pointer", margin: "10px", fontSize: "2rem" }} // Basic styling
          />
        </Tooltip>
      </div>
    );
  }

  // Changed component class name
  return <div className="RefLocale">{content}</div>;
}
