import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody"; // Import TableBody
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost";

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

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete the role for the api?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "role",
        action: "deleteApiRole",
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });
      if (result.data) {
        // Refresh the data after successful deletion
        window.location.reload();
      } else if (result.error) {
        console.error("Api Error", result.error);
      }
    }
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.roleId}</TableCell>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.apiVersion}</TableCell>
      <TableCell align="left">{row.endpoint}</TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    roleId: PropTypes.string.isRequired,
    apiId: PropTypes.string,
    apiVersion: PropTypes.string,
    endpoint: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function RolePermissionList(props) {
  const { rolePermissions } = props;
  return (
    <TableBody>
      {rolePermissions && rolePermissions.length > 0 ? (
        rolePermissions.map((rolePermission, index) => (
          <Row key={index} row={rolePermission} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No permissions assigned to this role.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RolePermissionList.propTypes = {
  rolePermissions: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function RolePermission() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [roleId, setRoleId] = useState(() => data?.roleId || "");
  const debouncedRoleId = useDebounce(roleId, 1000);
  const [apiId, setApiId] = useState(() => data?.apiId || "");
  const debouncedApiId = useDebounce(apiId, 1000);
  const [apiVersion, setApiVersion] = useState(() => data?.apiVersion || "");
  const debouncedApiVersion = useDebounce(apiVersion, 1000);
  const [endpoint, setEndpoint] = useState(() => data?.endpoint || "");
  const debouncedEndpoint = useDebounce(endpoint, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [rolePermissions, setRolePermissions] = useState([]);

  const handleRoleIdChange = (event) => {
    setRoleId(event.target.value);
  };
  const handleApiIdChange = (event) => {
    setApiId(event.target.value);
  };
  const handleApiVersionChange = (event) => {
    setApiVersion(event.target.value);
  };
  const handleEndpointChange = (event) => {
    setEndpoint(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setRolePermissions([]);
      } else {
        const data = await response.json();
        setRolePermissions(data.rolePermissions);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setRolePermissions([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "role",
      action: "queryRolePermission",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        roleId: debouncedRoleId,
        apiId: debouncedApiId,
        apiVersion: debouncedApiVersion,
        endpoint: debouncedEndpoint,
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
    debouncedRoleId,
    debouncedApiId,
    debouncedApiVersion,
    debouncedEndpoint,
    fetchData, // Add fetchData to dependency array of useEffect
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = (roleId, apiId, apiVersion, endpoint) => {
    navigate("/app/form/createRolePermission", {
      state: { data: { roleId, apiId, apiVersion, endpoint } },
    });
  };

  let content;
  if (loading) {
    content = (
      <div>
        <CircularProgress />
      </div>
    );
  } else if (error) {
    content = (
      <div>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="collapsible table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Role Id"
                    value={roleId}
                    onChange={handleRoleIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Id"
                    value={apiId}
                    onChange={handleApiIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Version"
                    value={apiVersion}
                    onChange={handleApiVersionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Endpoint"
                    value={endpoint}
                    onChange={handleEndpointChange}
                  />
                </TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <RolePermissionList rolePermissions={rolePermissions} />
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
        <AddBoxIcon
          onClick={() => handleCreate(roleId, apiId, apiVersion, endpoint)}
        />
      </div>
    );
  }

  return <div className="App">{content}</div>;
}
