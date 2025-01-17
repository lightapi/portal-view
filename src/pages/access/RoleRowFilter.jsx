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
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (row) => {
    navigate("/app/form/updateRoleRowFilter", { state: { data: { ...row } } });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete the role row filter?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deleteRoleRowFilter",
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
      <TableCell align="left">{row.colName}</TableCell>
      <TableCell align="left">{row.operator}</TableCell>
      <TableCell align="left">{row.colValue}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
    </TableRow>
  );
}

Row.propTypes = {
  row: PropTypes.shape({
    roleId: PropTypes.string.isRequired,
    apiId: PropTypes.string.isRequired,
    apiVersion: PropTypes.string.isRequired,
    endpoint: PropTypes.string.isRequired,
    colName: PropTypes.string.isRequired,
    operator: PropTypes.string.isRequired,
    colValue: PropTypes.string.isRequired,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function RoleRowFilterList(props) {
  const { roleRowFilters } = props;
  return (
    <TableBody>
      {roleRowFilters && roleRowFilters.length > 0 ? (
        roleRowFilters.map((roleRowFilter, index) => (
          <Row key={index} row={roleRowFilter} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={4} align="center">
            No row filters assigned to this role.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RoleRowFilterList.propTypes = {
  roleRowFilters: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function RoleRowFilter() {
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
  const [colName, setColName] = useState("");
  const debouncedColName = useDebounce(colName, 1000);
  const [operator, setOperator] = useState("");
  const debouncedOperator = useDebounce(operator, 1000);
  const [colValue, setColValue] = useState("");
  const debouncedColValue = useDebounce(colValue, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [roleRowFilters, setRoleRowFilters] = useState([]);

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

  const handleColNameChange = (event) => {
    setColName(event.target.value);
  };

  const handleOperatorChange = (event) => {
    setOperator(event.target.value);
  };

  const handleColValueChange = (event) => {
    setColValue(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setRoleRowFilters([]);
      } else {
        const data = await response.json();
        setRoleRowFilters(data.roleRowFilters);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setRoleRowFilters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "market",
      action: "queryRoleRowFilter",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        roleId: debouncedRoleId,
        apiId: debouncedApiId,
        apiVersion: debouncedApiVersion,
        endpoint: debouncedEndpoint,
        colName: debouncedColName,
        operator: debouncedOperator,
        colValue: debouncedColValue,
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
    debouncedColName,
    debouncedOperator,
    debouncedColValue,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = (roleId, apiId, apiVersion, endpoint) => {
    navigate("/app/form/createRoleRowFilter", {
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
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Column Name"
                    value={colName}
                    onChange={handleColNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Operator"
                    value={operator}
                    onChange={handleOperatorChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Column Value"
                    value={colValue}
                    onChange={handleColValueChange}
                  />
                </TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <RoleRowFilterList roleRowFilters={roleRowFilters} />
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
