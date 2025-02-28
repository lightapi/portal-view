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

  const handleUpdate = (instanceApp) => {
    navigate("/app/form/updateInstanceApp", {
      state: { data: { ...instanceApp } },
    });
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this instance app?")) {
      const cmd = {
        host: "lightapi.net",
        service: "instance",
        action: "deleteInstanceApp",
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

  const handleConfig = (instanceId, appId, appVersion) => {
    navigate("/app/config/configInstanceApp", {
      state: { data: { instanceId, appId, appVersion } },
    });
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.instanceId}-${row.appId}-${row.appVersion}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.instanceId}</TableCell>
      <TableCell align="left">{row.appId}</TableCell>
      <TableCell align="left">{row.appVersion}</TableCell>
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
            handleConfig(row.instanceId, row.appId, row.appVersion)
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
    appId: PropTypes.string.isRequired,
    appVersion: PropTypes.string.isRequired,
    active: PropTypes.bool,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function InstanceAppList(props) {
  const { instanceApps } = props;
  return (
    <TableBody>
      {instanceApps && instanceApps.length > 0 ? (
        instanceApps.map((instanceApp, index) => (
          <Row key={index} row={instanceApp} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={9} align="center">
            {" "}
            {/* Adjust colSpan as necessary */}
            No instance Apps found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

InstanceAppList.propTypes = {
  instanceApps: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function InstanceAppAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;

  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [instanceId, setInstanceId] = useState(() => data?.instanceId || "");
  const debouncedInstanceId = useDebounce(instanceId, 1000);
  const [appId, setAppId] = useState(() => data?.appId || "");
  const debouncedAppId = useDebounce(appId, 1000);
  const [appVersion, setAppVersion] = useState(() => data?.appVersion || "");
  const debouncedAppVersion = useDebounce(appVersion, 1000);
  const [active, setActive] = useState("");
  const debouncedActive = useDebounce(active, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [instanceApps, setInstanceApps] = useState([]);

  const handleInstanceIdChange = (event) => {
    setInstanceId(event.target.value);
  };

  const handleAppIdChange = (event) => {
    setAppId(event.target.value);
  };

  const handleAppVersionChange = (event) => {
    setAppVersion(event.target.value);
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
        setInstanceApps([]);
      } else {
        const data = await response.json();
        setInstanceApps(data.instanceApps || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setInstanceApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "instance",
      action: "getInstanceApp",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        instanceId: debouncedInstanceId,
        appId: debouncedAppId,
        appVersion: debouncedAppVersion,
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
    debouncedAppId,
    debouncedAppVersion,
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

  const handleCreate = () => {
    navigate("/app/form/createInstanceApp");
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
          <Table aria-label="instance app table">
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
                    placeholder="App Id"
                    value={appId}
                    onChange={handleAppIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="App Version"
                    value={appVersion}
                    onChange={handleAppVersionChange}
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
            <InstanceAppList instanceApps={instanceApps} />
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
          onClick={() => handleCreate(instanceId, appId, appVersion)}
        />
      </div>
    );
  }

  return <div className="InstanceAppAdmin">{content}</div>;
}
