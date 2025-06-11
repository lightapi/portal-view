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
import PublicIcon from "@mui/icons-material/Public";
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
    // Basic input styling
    fontSize: "inherit",
    padding: "4px 8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    width: "90%", // Adjust width as needed
  },
  iconButton: {
    cursor: "pointer",
    padding: "4px", // Add padding around icons
    "&:hover": {
      color: "primary.main", // Or your theme's primary color
    },
  },
});

// --- Row Component for Category ---
function CategoryRow(props) {
  const navigate = useNavigate();
  const { row, onDataRefresh } = props; // Added onDataRefresh prop
  const classes = useRowStyles();

  const handleUpdate = (category) => {
    navigate("/app/form/updateCategory", {
      // Adjust path as needed
      state: { data: { ...category } }, // Pass category data to update form
    });
  };

  const handleDelete = async (row) => {
    // Use categoryId and potentially hostId for deletion confirmation
    if (
      window.confirm(
        `Are you sure you want to delete category "${row.categoryName}" (${row.categoryId})?`,
      )
    ) {
      const cmd = {
        host: "lightapi.net", // Adjust if needed
        service: "category", // Service name
        action: "deleteCategory", // Delete action
        version: "0.1.0", // Adjust version if needed
        data: {
          // Send identifying data
          categoryId: row.categoryId,
          // hostId is not strictly needed for delete by primary key (categoryId),
          // but might be useful for permissions on the backend
          hostId: row.hostId,
        },
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });
      if (result.data) {
        // Refresh the data after successful deletion
        // Consider a more targeted refresh instead of full reload for better UX
        // window.location.reload();
        alert("Category deleted successfully.");
        onDataRefresh(); // Trigger data refresh in parent
      } else if (result.error) {
        console.error("API Error deleting category:", result.error);
        alert(
          `Error deleting category: ${result.error.description || result.error.message || "Unknown error"}`,
        );
      }
    }
  };

  return (
    <TableRow className={classes.root} key={row.categoryId}>
      <TableCell align="left">
        {row.hostId ? (
          row.hostId
        ) : (
          <Tooltip title="Global">
            <PublicIcon fontSize="small" color="disabled" />
          </Tooltip>
        )}
      </TableCell>
      <TableCell align="left" component="th" scope="row">
        {row.categoryId}
      </TableCell>
      <TableCell align="left">{row.entityType}</TableCell>
      <TableCell align="left">{row.categoryName}</TableCell>
      <TableCell
        align="left"
        style={{
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <Tooltip title={row.categoryDesc || ""}>
          <span>{row.categoryDesc}</span>
        </Tooltip>
      </TableCell>
      <TableCell align="left">{row.parentCategoryId}</TableCell>
      <TableCell align="left">{row.sortOrder}</TableCell>
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

// PropTypes validation for CategoryRow
CategoryRow.propTypes = {
  row: PropTypes.shape({
    categoryId: PropTypes.string.isRequired,
    hostId: PropTypes.string, // Optional (null for global)
    entityType: PropTypes.string.isRequired,
    categoryName: PropTypes.string.isRequired,
    categoryDesc: PropTypes.string,
    parentCategoryId: PropTypes.string,
    sortOrder: PropTypes.number,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string, // Keep as string, formatting done in render
  }).isRequired,
  onDataRefresh: PropTypes.func.isRequired, // Function to trigger data refresh
};

// --- List Component ---
function CategoryList(props) {
  const { categories, onDataRefresh } = props;
  return (
    <TableBody>
      {categories && categories.length > 0 ? (
        categories.map((category) => (
          <CategoryRow
            key={category.categoryId}
            row={category}
            onDataRefresh={onDataRefresh}
          />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={11} align="center">
            {" "}
            {/* Adjusted colSpan */}
            No categories found matching your criteria.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

CategoryList.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDataRefresh: PropTypes.func.isRequired,
};

// --- Main Category Component ---
export default function Category() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState(); // Use host from context for default filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Filter states
  const [categoryId, setCategoryId] = useState("");
  const debouncedCategoryId = useDebounce(categoryId, 1000);
  const [entityType, setEntityType] = useState("");
  const debouncedEntityType = useDebounce(entityType, 1000);
  const [categoryName, setCategoryName] = useState("");
  const debouncedCategoryName = useDebounce(categoryName, 1000);
  // Add other filters if needed (e.g., parentCategoryId)

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // Initialize error to null
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // State to trigger refresh

  // Filter change handlers
  const handleCategoryIdChange = (event) => setCategoryId(event.target.value);
  const handleEntityTypeChange = (event) => setEntityType(event.target.value);
  const handleCategoryNameChange = (event) =>
    setCategoryName(event.target.value);

  // Data fetching function
  const fetchData = useCallback(async (apiUrl, apiHeaders) => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const response = await fetch(apiUrl, {
        headers: apiHeaders,
        credentials: "include",
      });
      if (!response.ok) {
        let errorPayload = {
          status: response.status,
          statusText: response.statusText,
        };
        errorPayload = await response.json();
        console.error("Fetch error:", errorPayload);
        setError(errorPayload);
        setCategories([]);
        setTotal(0);
      } else {
        const data = await response.json();
        console.log("Fetched categories:", data);
        setCategories(data.categories || []); // Assuming response is { total: number, categories: [] }
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Network or other error:", e);
      setError({ message: e.message || "Failed to fetch data" }); // Set generic error
      setCategories([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  // Effect to fetch data when filters or pagination change
  useEffect(() => {
    // Construct query data based on current state and debounced values
    const queryData = {
      hostId: host, // Use host from context by default
      offset: page * rowsPerPage,
      limit: rowsPerPage,
      // Only include non-empty filter values
      ...(debouncedCategoryId && { categoryId: debouncedCategoryId }),
      ...(debouncedEntityType && { entityType: debouncedEntityType }),
      ...(debouncedCategoryName && { categoryName: debouncedCategoryName }),
      // Add other filter parameters here if implemented
      // parentCategoryId: debouncedParentCategoryId,
      // globalFlag: ... (handled by backend based on hostId presence)
      // active: true // Example: uncomment to only fetch active by default
    };

    const cmd = {
      host: "lightapi.net", // Adjust if needed
      service: "category", // Service name for categories
      action: "getCategory", // Action name
      version: "0.1.0", // Adjust version if needed
      data: queryData,
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") }; // Adjust CSRF token handling if needed

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedCategoryId,
    debouncedEntityType,
    debouncedCategoryName,
    // Add other debounced filter states here
    fetchData,
    refreshTrigger, // Add refreshTrigger to dependencies
  ]);

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0); // Reset to first page when changing rows per page
  };

  // Create handler
  const handleCreate = () => {
    navigate("/app/form/createCategory"); // Adjust navigation path
  };

  // Refresh handler
  const handleDataRefresh = () => {
    setRefreshTrigger((prev) => prev + 1); // Increment trigger to refetch
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
        <h4>Error Fetching Categories:</h4>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table stickyHeader aria-label="category table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Category ID"
                    value={categoryId}
                    onChange={handleCategoryIdChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Entity Type"
                    value={entityType}
                    onChange={handleEntityTypeChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Category Name"
                    value={categoryName}
                    onChange={handleCategoryNameChange}
                    className={classes.input}
                  />
                </TableCell>
                <TableCell align="left">Description</TableCell>
                <TableCell align="left">Parent ID</TableCell>
                <TableCell align="left">Sort Order</TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <CategoryList
              categories={categories}
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
        <Tooltip title="Create New Category">
          <AddBoxIcon
            className={classes.iconButton}
            onClick={handleCreate}
            style={{ margin: "10px", fontSize: "30px" }}
          />
        </Tooltip>
      </div>
    );
  }

  return <div className="CategoryAdmin">{content}</div>;
}
