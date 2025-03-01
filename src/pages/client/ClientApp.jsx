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
import AirlineSeatReclineNormalIcon from "@mui/icons-material/AirlineSeatReclineNormal";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
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

  const handleUpdate = (app) => {
    navigate("/app/form/updateApp", { state: { data: { ...app } } });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete the app for the host?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "client",
        action: "deleteApp",
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

  const handleClient = (hostId, appId) => {
    navigate("/app/client", { state: { data: { hostId, appId } } });
  };

  const handleInstanceApp = (hostId, appId) => {
    navigate("/app/instance/InstanceApp", {
      state: { data: { hostId, appId } },
    });
  };

  return (
    <TableRow className={classes.root} key={row.appId}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.appId}</TableCell>
      <TableCell align="left">{row.appName}</TableCell>
      <TableCell align="left">{row.appDesc}</TableCell>
      <TableCell align="left">{row.isKafkaApp ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.operationOwner}</TableCell>
      <TableCell align="left">{row.deliveryOwner}</TableCell>
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
        <AirlineSeatReclineNormalIcon
          onClick={() => handleClient(row.hostId, row.appId)}
        />
      </TableCell>
      <TableCell align="right">
        <ContentCopyIcon
          onClick={() => handleInstanceApp(row.hostId, row.appId)}
        />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    appId: PropTypes.string.isRequired,
    appName: PropTypes.string,
    appDesc: PropTypes.string,
    isKafkaApp: PropTypes.bool,
    operationOwner: PropTypes.string,
    deliveryOwner: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
  onDelete: PropTypes.func.isRequired,
};

function AppList(props) {
  const { apps } = props;
  return (
    <TableBody>
      {apps && apps.length > 0 ? (
        apps.map((app, index) => <Row key={index} row={app} />)
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No apps found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

AppList.propTypes = {
  apps: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ClientApp() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [appId, setAppId] = useState("");
  const debouncedAppId = useDebounce(appId, 1000);
  const [appName, setAppName] = useState("");
  const debouncedAppName = useDebounce(appName, 1000);
  const [appDesc, setAppDesc] = useState("");
  const debouncedAppDesc = useDebounce(appDesc, 1000);
  const [isKafkaApp, setIsKafkaApp] = useState("");
  const debouncedIsKafkaApp = useDebounce(isKafkaApp, 1000);
  const [operationOwner, setOperationOwner] = useState("");
  const debouncedOperationOwner = useDebounce(operationOwner, 1000);
  const [deliveryOwner, setDeliveryOwner] = useState("");
  const debouncedDeliveryOwner = useDebounce(deliveryOwner, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [apps, setApps] = useState([]);

  const handleAppIdChange = (event) => {
    setAppId(event.target.value);
  };
  const handleAppNameChange = (event) => {
    setAppName(event.target.value);
  };
  const handleAppDescChange = (event) => {
    setAppDesc(event.target.value);
  };
  const handleIsKafkaAppChange = (event) => {
    setIsKafkaApp(event.target.value);
  };
  const handleOperationOwnerChange = (event) => {
    setOperationOwner(event.target.value);
  };
  const handleDeliveryOwnerChange = (event) => {
    setDeliveryOwner(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setApps([]);
      } else {
        const data = await response.json();
        console.log(data);
        setApps(data.apps);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "client",
      action: "getApp",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        appId: debouncedAppId,
        appName: debouncedAppName,
        appDesc: debouncedAppDesc,
        operationOwner: debouncedOperationOwner,
        deliveryOwner: debouncedDeliveryOwner,
        ...(debouncedIsKafkaApp && debouncedIsKafkaApp.trim() !== ""
          ? { isKafkaApp: stringToBoolean(debouncedIsKafkaApp) }
          : {}), // Conditional spread
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    console.log("fetchData is called", url, headers);
    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedAppId,
    debouncedAppName,
    debouncedAppDesc,
    debouncedIsKafkaApp,
    debouncedOperationOwner,
    debouncedDeliveryOwner,
    fetchData, // Add fetchData to dependency array of useEffect
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createApp");
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
                <TableCell align="left">{host}</TableCell>
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
                    placeholder="App Name"
                    value={appName}
                    onChange={handleAppNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="App Desc"
                    value={appDesc}
                    onChange={handleAppDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Is Kafka App"
                    value={isKafkaApp}
                    onChange={handleIsKafkaAppChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Operation Owner"
                    value={operationOwner}
                    onChange={handleOperationOwnerChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Delivery Owner"
                    value={deliveryOwner}
                    onChange={handleDeliveryOwnerChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">OAuth Client</TableCell>
                <TableCell align="right">Instance App</TableCell>
              </TableRow>
            </TableHead>
            <AppList apps={apps} />
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
        <AddBoxIcon onClick={() => handleCreate()} />
      </div>
    );
  }

  return <div className="App">{content}</div>;
}
