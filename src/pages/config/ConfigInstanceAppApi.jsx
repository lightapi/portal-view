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
});

function Row(props) {
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (configInstanceAppApi) => {
    navigate("/app/form/updateConfigInstanceAppApi", {
      state: { data: { ...configInstanceAppApi } },
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete this config instance app api property?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "config",
        action: "deleteConfigInstanceAppApi",
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
        // Optionally, show an error message to the user
      }
    }
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.instanceAppId}-${row.instanceApiId}-${row.propertyId}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.instanceAppId}</TableCell>
      <TableCell align="left">{row.instanceApiId}</TableCell>
      <TableCell align="left">{row.instanceId}</TableCell>
      <TableCell align="left">{row.instanceName}</TableCell>
      <TableCell align="left">{row.appId}</TableCell>
      <TableCell align="left">{row.appVersion}</TableCell>
      <TableCell align="left">{row.apiVersionId}</TableCell>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.apiVersion}</TableCell>
      <TableCell align="left">{row.configId}</TableCell>
      <TableCell align="left">{row.configName}</TableCell>
      <TableCell align="left">{row.propertyName}</TableCell>
      <TableCell align="left">{row.propertyId}</TableCell>
      <TableCell align="left">{row.propertyValue}</TableCell>
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
    </TableRow>
  );
}

Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    instanceAppId: PropTypes.string.isRequired,
    instanceApiId: PropTypes.string.isRequired,
    instanceId: PropTypes.string.isRequired,
    instanceName: PropTypes.string.isRequired,
    appId: PropTypes.string.isRequired,
    appVersion: PropTypes.string.isRequired,
    apiVersionId: PropTypes.string.isRequired,
    apiId: PropTypes.string.isRequired,
    apiVersion: PropTypes.string.isRequired,
    configId: PropTypes.string.isRequired,
    configName: PropTypes.string.isRequired,
    propertyId: PropTypes.string.isRequired,
    propertyName: PropTypes.string.isRequired,
    propertyValue: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ConfigInstanceAppApiList(props) {
  const { configInstanceAppApis } = props;
  return (
    <TableBody>
      {configInstanceAppApis && configInstanceAppApis.length > 0 ? (
        configInstanceAppApis.map((configInstanceAppApi, index) => (
          <Row key={index} row={configInstanceAppApi} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={12} align="center">
            {" "}
            {/* Adjust colSpan */}
            No config instance app api properties found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ConfigInstanceAppApiList.propTypes = {
  configInstanceAppApis: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ConfigInstanceAppApi() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;

  const { host } = useUserState(); // Get host from UserContext
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [instanceAppId, setInstanceAppId] = useState(
    () => data?.instanceAppId || "",
  );
  const debouncedInstanceAppId = useDebounce(instanceAppId, 1000);
  const [instanceApiId, setInstanceApiId] = useState(
    () => data?.instanceApiId || "",
  );
  const debouncedInstanceApiId = useDebounce(instanceApiId, 1000);
  const [instanceId, setInstanceId] = useState(() => data?.instanceId || "");
  const debouncedInstanceId = useDebounce(instanceId, 1000);
  const [instanceName, setInstanceName] = useState("");
  const debouncedInstanceName = useDebounce(instanceName, 1000);
  const [appId, setAppId] = useState(() => data?.appId || "");
  const debouncedAppId = useDebounce(appId, 1000);
  const [appVersion, setAppVersion] = useState(() => data?.appVersion || "");
  const debouncedAppVersion = useDebounce(appVersion, 1000);
  const [apiVersionId, setApiVersionId] = useState(
    () => data?.apiVersionId || "",
  );
  const debouncedApiVersionId = useDebounce(apiVersionId, 1000);
  const [apiId, setApiId] = useState(() => data?.apiId || "");
  const debouncedApiId = useDebounce(apiId, 1000);
  const [apiVersion, setApiVersion] = useState(() => data?.apiVersion || "");
  const debouncedApiVersion = useDebounce(apiVersion, 1000);
  const [configId, setConfigId] = useState(() => data?.configId || "");
  const debouncedConfigId = useDebounce(configId, 1000);
  const [configName, setConfigName] = useState("");
  const debouncedConfigName = useDebounce(configName, 1000);
  const [propertyId, setPropertyId] = useState("");
  const debouncedPropertyId = useDebounce(propertyId, 1000);
  const [propertyName, setPropertyName] = useState("");
  const debouncedPropertyName = useDebounce(propertyName, 1000);
  const [propertyValue, setPropertyValue] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [configInstanceAppApis, setConfigInstanceAppApis] = useState([]);

  const handleInstanceAppIdChange = (event) => {
    setInstanceAppId(event.target.value);
  };
  const handleInstanceApiIdChange = (event) => {
    setInstanceApiId(event.target.value);
  };
  const handleInstanceIdChange = (event) => {
    setInstanceId(event.target.value);
  };
  const handleInstanceNameChange = (event) => {
    setInstanceName(event.target.value);
  };
  const handleAppIdChange = (event) => {
    setAppId(event.target.value);
  };
  const handleAppVersionChange = (event) => {
    setAppVersion(event.target.value);
  };
  const handleApiVersionIdChange = (event) => {
    setApiVersionId(event.target.value);
  };
  const handleApiIdChange = (event) => {
    setApiId(event.target.value);
  };
  const handleApiVersionChange = (event) => {
    setApiVersion(event.target.value);
  };
  const handleConfigIdChange = (event) => {
    setConfigId(event.target.value);
  };
  const handleConfigNameChange = (event) => {
    setConfigName(event.target.value);
  };
  const handlePropertyIdChange = (event) => {
    setPropertyId(event.target.value);
  };
  const handlePropertyNameChange = (event) => {
    setPropertyName(event.target.value);
  };
  const handlePropertyValueChange = (event) => {
    setPropertyValue(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred.");
        setConfigInstanceAppApis([]);
      } else {
        const data = await response.json();
        console.log("data", data);
        setConfigInstanceAppApis(data.instanceAppApis || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setConfigInstanceAppApis([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "config",
      action: "getConfigInstanceAppApi",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        instanceAppId: debouncedInstanceAppId,
        instanceApiId: debouncedInstanceApiId,
        instanceId: debouncedInstanceId,
        instanceName: debouncedInstanceName,
        appId: debouncedAppId,
        appVersion: debouncedAppVersion,
        apiVersionId: debouncedApiVersionId,
        apiId: debouncedApiId,
        apiVersion: debouncedApiVersion,
        configId: debouncedConfigId,
        configName: debouncedConfigName,
        propertyId: debouncedPropertyId,
        propertyName: debouncedPropertyName,
        propertyValue: propertyValue,
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
    debouncedInstanceAppId,
    debouncedInstanceApiId,
    debouncedInstanceId,
    debouncedInstanceName,
    debouncedAppId,
    debouncedAppVersion,
    debouncedApiVersionId,
    debouncedApiId,
    debouncedApiVersion,
    debouncedConfigId,
    debouncedConfigName,
    debouncedPropertyId,
    debouncedPropertyName,
    propertyValue,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreate = (instanceId, instanceAppId, instanceApiId, configId) => {
    navigate("/app/form/createConfigInstanceAppApi", {
      state: {
        data: { instanceId, instanceAppId, instanceApiId, configId },
      },
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
          <Table aria-label="config instance app api table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Instance App Id"
                    value={instanceAppId}
                    onChange={handleInstanceAppIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Instance Api Id"
                    value={instanceApiId}
                    onChange={handleInstanceApiIdChange}
                  />
                </TableCell>
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
                    placeholder="Instance Name"
                    value={instanceName}
                    onChange={handleInstanceNameChange}
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
                    placeholder="Api Version Id"
                    value={apiVersionId}
                    onChange={handleApiVersionIdChange}
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
                    placeholder="Config Id"
                    value={configId}
                    onChange={handleConfigIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Config Name"
                    value={configName}
                    onChange={handleConfigNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Property Id"
                    value={propertyId}
                    onChange={handlePropertyIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Property Name"
                    value={propertyName}
                    onChange={handlePropertyNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Property Value"
                    value={propertyValue}
                    onChange={handlePropertyValueChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ConfigInstanceAppApiList
              configInstanceAppApis={configInstanceAppApis}
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
        <AddBoxIcon
          onClick={() =>
            handleCreate(instanceId, instanceAppId, instanceApiId, configId)
          }
        />
      </div>
    );
  }

  return <div className="ConfigInstanceAppApi">{content}</div>;
}
