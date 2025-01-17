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
      window.confirm(
        "Are you sure you want to delete the position for the api?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deletePositionPermission",
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
      <TableCell align="left">{row.positionId}</TableCell>
      <TableCell align="left">{row.inheritToAncestor}</TableCell>
      <TableCell align="left">{row.inheritToSibling}</TableCell>
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
    positionId: PropTypes.string.isRequired,
    inheritToAncestor: PropTypes.string,
    inheritToSibling: PropTypes.string,
    apiId: PropTypes.string,
    apiVersion: PropTypes.string,
    endpoint: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function PositionPermissionList(props) {
  const { positionPermissions } = props;
  return (
    <TableBody>
      {positionPermissions && positionPermissions.length > 0 ? (
        positionPermissions.map((positionPermission, index) => (
          <Row key={index} row={positionPermission} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No permissions assigned to this position.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

PositionPermissionList.propTypes = {
  positionPermissions: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function PositionPermission(props) {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [positionId, setPositionId] = useState(() => data?.positionId || "");
  const debouncedPositionId = useDebounce(positionId, 1000);
  const [inheritToAncestor, setInheritToAncestor] = useState("");
  const debouncedInheritToAncestor = useDebounce(inheritToAncestor, 1000);
  const [inheritToSibling, setInheritToSibling] = useState("");
  const debouncedInheritToSibling = useDebounce(inheritToSibling, 1000);
  const [apiId, setApiId] = useState(() => data?.apiId || "");
  const debouncedApiId = useDebounce(apiId, 1000);
  const [apiVersion, setApiVersion] = useState(() => data?.apiVersion || "");
  const debouncedApiVersion = useDebounce(apiVersion, 1000);
  const [endpoint, setEndpoint] = useState(() => data?.endpoint || "");
  const debouncedEndpoint = useDebounce(endpoint, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [positionPermissions, setPositionPermissions] = useState([]);

  const handlePositionIdChange = (event) => {
    setPositionId(event.target.value);
  };
  const handlePositionTypeChange = (event) => {
    setPositionType(event.target.value);
  };
  const handleInheritToAncestorChange = (event) => {
    setInheritToAncestor(event.target.value);
  };
  const handleInheritToSiblingChange = (event) => {
    setInheritToSibling(event.target.value);
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
        setPositionPermissions([]);
      } else {
        const data = await response.json();
        setPositionPermissions(data.positions);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setPositionPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "market",
      action: "queryPositionPermission",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        positionId: debouncedPositionId,
        inheritToAncestor: debouncedInheritToAncestor,
        inheritToSibling: debouncedInheritToSibling,
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
    debouncedPositionId,
    debouncedInheritToAncestor,
    debouncedInheritToSibling,
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

  const handleCreate = (positionId, apiId, apiVersion, endpoint) => {
    navigate("/app/form/createPositionPermission", {
      state: { data: { positionId, apiId, apiVersion, endpoint } },
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
                    placeholder="Position Id"
                    value={positionId}
                    onChange={handlePositionIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Inherit To Ancestor"
                    value={inheritToAncestor}
                    onChange={handleInheritToAncestorChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Inherit To Sibling"
                    value={inheritToSibling}
                    onChange={handleInheritToSiblingChange}
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
            <PositionPermissionList positionPermissions={positionPermissions} />
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
        <AddBoxIcon onClick={() => handleCreate(positionId, apiId, apiVersion, endpoint)} />
      </div>
    );
  }

  return <div className="App">{content}</div>;
}
