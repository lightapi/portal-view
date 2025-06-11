import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // Removed useLocation as it's not used here
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
import LinkIcon from "@mui/icons-material/Link";
import Tooltip from "@mui/material/Tooltip";
import { useUserState } from "../../contexts/UserContext"; // Assuming this is still relevant
import useDebounce from "../../hooks/useDebounce.js";
import { apiPost } from "../../api/apiPost.js";

const useRowStyles = makeStyles((theme) => ({
  // Added theme for potential primary color access
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
      color: theme?.palette?.primary?.main || "blue", // Fallback color
    },
  },
}));

function RelationTypeRow(props) {
  const navigate = useNavigate();
  const { row, onDeleteSuccess } = props;
  const classes = useRowStyles();

  const handleUpdate = (relationRow) => {
    console.log("Update Relation Type Row:", relationRow);
    navigate("/app/form/updateRelationType", {
      // <-- Navigate to updateRelationType form
      state: {
        data: { ...relationRow },
      },
    });
  };

  const handleDelete = async (relationRow) => {
    if (
      window.confirm(
        `Are you sure you want to delete this relation type? (Name: ${relationRow.relationName}, ID: ${relationRow.relationId})`,
      )
    ) {
      const cmd = {
        host: "lightapi.net", // Assuming standard host
        service: "ref", // Assuming 'ref' service
        action: "deleteRefRelationType", // <-- Action to delete relation type
        version: "0.1.0", // Use appropriate version
        data: {
          relationId: relationRow.relationId,
        },
      };
      console.log("Delete command:", cmd);

      const result = await apiPost({
        url: "/portal/command",
        headers: {}, // apiPost should handle auth/CSRF
        body: cmd,
      });

      if (result && !result.error) {
        // Check for non-error, result.data might be empty on success
        alert("Relation Type deleted successfully.");
        if (onDeleteSuccess) onDeleteSuccess(); // Trigger data refresh
      } else if (result && result.error) {
        console.error("API Error deleting Relation Type:", result.error);
        alert(
          `Error deleting Relation Type: ${result.error.description || result.error.message || "Unknown error"}`,
        );
      } else {
        // Handle case where result is undefined or not structured as expected
        console.error("Unexpected response from API during delete:", result);
        alert(
          "An unexpected error occurred while deleting. Check console for details.",
        );
      }
    }
  };

  const handleRelation = (relationId) => {
    navigate("/app/ref/relation", {
      state: { data: { relationId } },
    });
  };

  const truncateData = (data, maxLength = 70) => {
    if (!data) return "";
    if (data.length <= maxLength) return data;
    return data.substring(0, maxLength) + "...";
  };

  return (
    <TableRow className={classes.root} key={row.relationId}>
      <TableCell align="left">{row.relationId}</TableCell>
      <TableCell align="left">{row.relationName}</TableCell>
      <TableCell
        align="left"
        style={{
          maxWidth: 250,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <Tooltip title={row.relationDesc || ""}>
          <span>{truncateData(row.relationDesc)}</span>
        </Tooltip>
      </TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Update Relation Type">
          <SystemUpdateIcon
            className={classes.iconButton}
            onClick={() => handleUpdate(row)}
          />
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Delete Relation Type">
          <DeleteForeverIcon
            className={classes.iconButton}
            onClick={() => handleDelete(row)}
          />
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Ref Relation">
          <LinkIcon
            className={classes.iconButton}
            onClick={() => handleRelation(row.relationId)}
          />
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

RelationTypeRow.propTypes = {
  row: PropTypes.shape({
    relationId: PropTypes.string.isRequired,
    relationName: PropTypes.string.isRequired,
    relationDesc: PropTypes.string.isRequired,
    updateUser: PropTypes.string.isRequired,
    updateTs: PropTypes.string.isRequired,
  }).isRequired,
  onDeleteSuccess: PropTypes.func,
};

function RelationTypeList(props) {
  const { relationTypes, onDeleteSuccess } = props;
  return (
    <TableBody>
      {relationTypes && relationTypes.length > 0 ? (
        relationTypes.map((relationRow) => (
          <RelationTypeRow
            key={relationRow.relationId}
            row={relationRow}
            onDeleteSuccess={onDeleteSuccess}
          />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={7} align="center">
            {" "}
            {/* Adjusted colSpan */}
            No Relation Types found matching your criteria.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RelationTypeList.propTypes = {
  relationTypes: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDeleteSuccess: PropTypes.func,
};

// --- Main RelationTypeAdmin Component ---
export default function RelationTypeAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { host } = useUserState(); // Assuming host is needed for API calls

  // Filter State
  const [relationId, setRelationId] = useState("");
  const debouncedRelationId = useDebounce(relationId, 1000);
  const [relationName, setRelationName] = useState("");
  const debouncedRelationName = useDebounce(relationName, 1000);
  const [relationDesc, setRelationDesc] = useState("");
  const debouncedRelationDesc = useDebounce(relationDesc, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [relationTypes, setRelationTypes] = useState([]); // State for relation types

  // Filter Input Handlers
  const handleRelationIdChange = (event) => setRelationId(event.target.value);
  const handleRelationNameChange = (event) =>
    setRelationName(event.target.value);
  const handleRelationDescChange = (event) =>
    setRelationDesc(event.target.value);

  // To force a re-fetch, e.g., after a delete
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerDataRefresh = () => setRefreshTrigger((prev) => prev + 1);

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
        setRelationTypes([]);
        setTotal(0);
      } else {
        console.log("API Success Response:", responseData);
        // Assuming the API returns { relationTypes: [], total: 0 }
        setRelationTypes(responseData.relationTypes || []);
        setTotal(responseData.total || 0);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
      setError(e.message || "An unexpected error occurred");
      setRelationTypes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []); // No direct dependencies for the function itself

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "ref",
      action: "getRefRelationType", // Action from spec
      version: "0.1.0", // Use appropriate version
      data: {
        hostId: host, // Assuming hostId might be used by the backend
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        // Optional filters
        ...(debouncedRelationId && { relationId: debouncedRelationId }),
        ...(debouncedRelationName && { relationName: debouncedRelationName }),
        ...(debouncedRelationDesc && { relationDesc: debouncedRelationDesc }),
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
    debouncedRelationId,
    debouncedRelationName,
    debouncedRelationDesc,
    fetchData,
    refreshTrigger, // Add refreshTrigger as a dependency
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    console.log("Navigate to create Relation Type page");
    navigate("/app/form/createRelationType"); // No specific data needed for creation usually
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
        <h4>Error Fetching Relation Types:</h4>
        <pre>
          {typeof error === "string" ? error : JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="relation type table">
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
                    placeholder="Relation Desc"
                    value={relationDesc}
                    onChange={handleRelationDescChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Relation</TableCell>
              </TableRow>
            </TableHead>
            <RelationTypeList
              relationTypes={relationTypes}
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
        <Tooltip title="Add New Relation Type">
          <AddBoxIcon
            onClick={handleCreate}
            style={{ cursor: "pointer", margin: "10px", fontSize: "2rem" }}
          />
        </Tooltip>
      </div>
    );
  }

  return <div className="RelationTypeAdmin">{content}</div>;
}
