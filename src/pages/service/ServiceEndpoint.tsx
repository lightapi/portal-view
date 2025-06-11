import { useNavigate, useLocation } from "react-router-dom";
import makeStyles from "@mui/styles/makeStyles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import FilterListIcon from "@mui/icons-material/FilterList";
import AccessibleForwardIcon from "@mui/icons-material/AccessibleForward";
import DoNotTouchIcon from "@mui/icons-material/DoNotTouch";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import AccessibilityIcon from "@mui/icons-material/Accessibility";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import PropTypes from "prop-types";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useUserState } from "../../contexts/UserContext";
import Cookies from "universal-cookie";
import useStyles from "./styles";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const navigate = useNavigate();
  Row.propTypes = {
    row: PropTypes.shape({
      hostId: PropTypes.string.isRequired,
      apiId: PropTypes.string.isRequired,
      apiVersion: PropTypes.string.isRequired,
      endpoint: PropTypes.string.isRequired,
      httpMethod: PropTypes.string.isRequired,
      endpointPath: PropTypes.string.isRequired,
      endpointDesc: PropTypes.string.isRequired,
    }).isRequired,
  };
  const { row } = props;
  console.log(row);
  const classes = useRowStyles();

  const listScopes = () => {
    navigate("/app/listScope", {
      state: {
        hostId: row.hostId,
        apiId: row.apiId,
        apiVersion: row.apiVersion,
        endpoint: row.endpoint,
      },
    });
  };
  const listRules = () => {
    navigate("/app/listRule", {
      state: {
        hostId: row.hostId,
        apiId: row.apiId,
        apiVersion: row.apiVersion,
        endpoint: row.endpoint,
      },
    });
  };

  const handleRolePermission = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/rolePermission", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleRoleRowFilter = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/roleRowFilter", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleRoleColFilter = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/roleColFilter", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleGroupPermission = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/groupPermission", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleGroupRowFilter = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/groupRowFilter", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleGroupColFilter = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/groupColFilter", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handlePositionPermission = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/positionPermission", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handlePositionRowFilter = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/positionRowFilter", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handlePositionColFilter = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/positionColFilter", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleAttributePermission = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/attributePermission", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleAttributeRowFilter = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/attributeRowFilter", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleAttributeColFilter = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/attributeColFilter", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  const handleUserPermission = (apiId, apiVersion, endpoint) => {
    navigate("/app/access/userPermission", {
      state: { data: { apiId, apiVersion, endpoint } },
    });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.apiVersion}</TableCell>
      <TableCell align="left">{row.endpoint}</TableCell>
      <TableCell align="left">{row.httpMethod}</TableCell>
      <TableCell align="left">{row.endpointPath}</TableCell>
      <TableCell align="left">{row.endpointDesc}</TableCell>
      <TableCell align="right">
        <AccessibleForwardIcon onClick={() => listScopes(row)} />
      </TableCell>
      <TableCell align="right">
        <FilterListIcon onClick={() => listRules(row)} />
      </TableCell>
      <TableCell align="right">
        <DoNotTouchIcon
          onClick={() =>
            handleRolePermission(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowDownIcon
          onClick={() =>
            handleRoleRowFilter(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowRightIcon
          onClick={() =>
            handleRoleColFilter(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <DoNotTouchIcon
          onClick={() =>
            handleGroupPermission(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowDownIcon
          onClick={() =>
            handleGroupRowFilter(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowRightIcon
          onClick={() =>
            handleGroupColFilter(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <DoNotTouchIcon
          onClick={() =>
            handlePositionPermission(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowDownIcon
          onClick={() =>
            handlePositionRowFilter(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowRightIcon
          onClick={() =>
            handlePositionColFilter(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <DoNotTouchIcon
          onClick={() =>
            handleAttributePermission(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowDownIcon
          onClick={() =>
            handleAttributeRowFilter(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowRightIcon
          onClick={() =>
            handleAttributeColFilter(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
      <TableCell align="right">
        <AccessibilityIcon
          onClick={() =>
            handleUserPermission(row.apiId, row.apiVersion, row.endpoint)
          }
        />
      </TableCell>
    </TableRow>
  );
}

export default function ServiceEndpoint() {
  const classes = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();
  const {
    hostId,
    apiId: initialApiId,
    apiVersion: initialApiVersion,
  } = location.state.data;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [endpoint, setEndpoint] = useState("");
  const debouncedEndpoint = useDebounce(endpoint, 1000);
  const [httpMethod, setHttpMethod] = useState("");
  const debouncedHttpMethod = useDebounce(httpMethod, 1000);
  const [endpointPath, setEndpointPath] = useState("");
  const debouncedEndpointPath = useDebounce(endpointPath, 1000);
  const [endpointDesc, setEndpointDesc] = useState("");
  const debouncedEndpointDesc = useDebounce(endpointDesc, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [endpoints, setEndpoints] = useState([]);

  const handleEndpointChange = (event) => {
    setEndpoint(event.target.value);
  };
  const handleHttpMethodChange = (event) => {
    setHttpMethod(event.target.value);
  };
  const handleEndpointPathChange = (event) => {
    setEndpointPath(event.target.value);
  };
  const handleEndpointDescChange = (event) => {
    setEndpointDesc(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setEndpoints([]);
        setTotal(0);
      } else {
        const data = await response.json();
        setEndpoints(data.endpoints);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setEndpoints([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "service",
      action: "getServiceEndpoint",
      version: "0.1.0",
      data: {
        hostId: hostId,
        apiId: initialApiId,
        apiVersion: initialApiVersion,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        endpoint: debouncedEndpoint,
        httpMethod: debouncedHttpMethod,
        endpointPath: debouncedEndpointPath,
        endpointDesc: debouncedEndpointDesc,
      },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    hostId,
    initialApiId,
    initialApiVersion,
    debouncedEndpoint,
    debouncedHttpMethod,
    debouncedEndpointPath,
    debouncedEndpointDesc,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
                <TableCell align="left">Host Id</TableCell>
                <TableCell align="left">Api Id</TableCell>
                <TableCell align="left">Api Version</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Endpoint"
                    value={endpoint}
                    onChange={handleEndpointChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="HTTP Method"
                    value={httpMethod}
                    onChange={handleHttpMethodChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Endpoint Path"
                    value={endpointPath}
                    onChange={handleEndpointPathChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Endpoint Desc"
                    value={endpointDesc}
                    onChange={handleEndpointDescChange}
                  />
                </TableCell>
                <TableCell align="right">Scopes</TableCell>
                <TableCell align="right">Rules</TableCell>
                <TableCell align="right">Role Permission</TableCell>
                <TableCell align="right">Role Row Filter</TableCell>
                <TableCell align="right">Role Col Filter</TableCell>
                <TableCell align="right">Group Permission</TableCell>
                <TableCell align="right">Group Row Filter</TableCell>
                <TableCell align="right">Group Col Filter</TableCell>
                <TableCell align="right">Position Permission</TableCell>
                <TableCell align="right">Position Row Filter</TableCell>
                <TableCell align="right">Position Col Filter</TableCell>
                <TableCell align="right">Attribute Permission</TableCell>
                <TableCell align="right">Attribute Row Filter</TableCell>
                <TableCell align="right">Attribute Col Filter</TableCell>
                <TableCell align="right">User Permission</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {endpoints &&
                endpoints.map((row) => (
                  <Row
                    key={row.hostId + row.apiId + row.apiVersion + row.endpoint}
                    row={row}
                  />
                ))}
            </TableBody>
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
