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
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useLocation, useNavigate } from "react-router-dom";
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
});

function Row(props) {
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (instanceApi) => {
    navigate("/app/form/updateInstanceApi", {
      state: { data: { ...instanceApi } },
    });
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this instance api?")) {
      const cmd = {
        host: "lightapi.net",
        service: "instance",
        action: "deleteInstanceApi",
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });

      if (result.data) {
        window.location.reload();
      } else if (result.error) {
        console.error("API Error:", result.error);
        // Optionally, show an error to the user
      }
    }
  };

  const handleConfig = (instanceId, apiId, apiVersion) => {
    navigate("/app/config/configInstanceApi", {
      state: { data: { instanceId, apiId, apiVersion } },
    });
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.instanceId}-${row.apiId}-${row.apiVersion}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.instanceId}</TableCell>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.apiVersion}</TableCell>
      <TableCell align="left">{row.active ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
      <TableCell align="right">
        <AddToDriveIcon
          onClick={() =>
            handleConfig(row.instanceId, row.apiId, row.apiVersion)
          }
        />
      </TableCell>
    </TableRow>
  );
}

Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    instanceId: PropTypes.string.isRequired,
    apiId: PropTypes.string.isRequired,
    apiVersion: PropTypes.string.isRequired,
    active: PropTypes.bool,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function InstanceApiList(props) {
  const { instanceApis } = props;
  return (
    <TableBody>
      {instanceApis && instanceApis.length > 0 ? (
        instanceApis.map((instanceApi, index) => (
          <Row key={index} row={instanceApi} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={9} align="center">
            {" "}
            {/* Adjust colSpan as necessary */}
            No instance Apis found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

InstanceApiList.propTypes = {
  instanceApis: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function InstanceApiAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;

  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [instanceId, setInstanceId] = useState(() => data?.instanceId || "");
  const debouncedInstanceId = useDebounce(instanceId, 1000);
  const [apiId, setApiId] = useState(() => data?.apiId || "");
  const debouncedApiId = useDebounce(apiId, 1000);
  const [apiVersion, setApiVersion] = useState(() => data?.apiVersion || "");
  const debouncedApiVersion = useDebounce(apiVersion, 1000);
  const [active, setActive] = useState("");
  const debouncedActive = useDebounce(active, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [instanceApis, setInstanceApis] = useState([]);

  const handleInstanceIdChange = (event) => {
    setInstanceId(event.target.value);
  };

  const handleApiIdChange = (event) => {
    setApiId(event.target.value);
  };

  const handleApiVersionChange = (event) => {
    setApiVersion(event.target.value);
  };
  const handleActiveChange = (event) => {
    setActive(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred.");
        setInstanceApis([]);
      } else {
        const data = await response.json();
        setInstanceApis(data.instanceApis || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setInstanceApis([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "instance",
      action: "getInstanceApi",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        instanceId: debouncedInstanceId,
        apiId: debouncedApiId,
        apiVersion: debouncedApiVersion,
        ...(debouncedActive && debouncedActive.trim() !== ""
          ? { active: stringToBoolean(debouncedActive) }
          : {}),
      },
    };

    const url = `/portal/query?cmd=${encodeURIComponent(JSON.stringify(cmd))}`;
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedInstanceId,
    debouncedApiId,
    debouncedApiVersion,
    debouncedActive,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreate = (instanceId, apiId, apiVersion) => {
    navigate("/app/form/createInstanceApi", {
      state: { data: { instanceId, apiId, apiVersion } },
    });
  };

  let content;

  if (loading) {
    content = <CircularProgress />;
  } else if (error) {
    content = <div style={{ color: "red" }}>Error: {error}</div>;
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="instance API table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Instance Id"
                    value={instanceId}
                    onChange={handleInstanceIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="API Id"
                    value={apiId}
                    onChange={handleApiIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="API Version"
                    value={apiVersion}
                    onChange={handleApiVersionChange}
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
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Config</TableCell>
              </TableRow>
            </TableHead>
            <InstanceApiList instanceApis={instanceApis} />
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
          onClick={() => handleCreate(instanceId, apiId, apiVersion)}
        />
      </div>
    );
  }

  return <div className="InstanceApiAdmin">{content}</div>;
}
