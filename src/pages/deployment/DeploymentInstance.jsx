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

  const handleUpdate = (instance) => {
    navigate("/app/form/updateDeploymentInstance", {
      state: { data: { ...instance } },
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete this deployment instance?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "deployment",
        action: "deleteDeploymentInstance",
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
        console.error("Api Error", result.error);
      }
    }
  };

  const handleConfig = (instanceId) => {
    navigate("/app/config/configDeploymentInstance", {
      state: { data: { instanceId } },
    });
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.deploymentInstanceId}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.instanceId}</TableCell>
      <TableCell align="left">{row.instanceName}</TableCell>
      <TableCell align="left">{row.deploymentInstanceId}</TableCell>
      <TableCell align="left">{row.serviceId}</TableCell>
      <TableCell align="left">{row.ipAddress}</TableCell>
      <TableCell align="left">{row.portNumber}</TableCell>
      <TableCell align="left">{row.systemEnv}</TableCell>
      <TableCell align="left">{row.runtimeEnv}</TableCell>
      <TableCell align="left">{row.pipelineId}</TableCell>
      <TableCell align="left">{row.pipelineName}</TableCell>
      <TableCell align="left">{row.pipelineVersion}</TableCell>
      <TableCell align="left">{row.deployStatus}</TableCell>
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
          onClick={() => handleConfig(row.deploymentInstanceId)}
        />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    instanceId: PropTypes.string.isRequired,
    instanceName: PropTypes.string,
    deploymentInstanceId: PropTypes.string.isRequired,
    serviceId: PropTypes.string,
    ipAddress: PropTypes.string,
    portNumber: PropTypes.int,
    systemEnv: PropTypes.string.isRequired,
    runtimeEnv: PropTypes.string.isRequired,
    pipelineId: PropTypes.string,
    pipelineName: PropTypes.string,
    pipelineVersion: PropTypes.string,
    deployStatus: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function InstanceList(props) {
  const { instances } = props;
  return (
    <TableBody>
      {instances && instances.length > 0 ? (
        instances.map((instance, index) => <Row key={index} row={instance} />)
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No deployment instances found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

InstanceList.propTypes = {
  instances: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function InstanceAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [instanceId, setInstanceId] = useState(() => data?.instanceId || "");
  const debouncedInstanceId = useDebounce(instanceId, 1000);
  const [instanceName, setInstanceName] = useState(
    () => data?.instanceName || "",
  );
  const debouncedInstanceName = useDebounce(instanceName, 1000);
  const [deploymentInstanceId, setDeploymentInstanceId] = useState("");
  const debouncedDeploymentInstanceId = useDebounce(deploymentInstanceId, 1000);
  const [serviceId, setServiceId] = useState(() => data?.serviceId || "");
  const debouncedServiceId = useDebounce(serviceId, 1000);
  const [ipAddress, setIpAddress] = useState("");
  const debouncedIpAddress = useDebounce(ipAddress, 1000);
  const [portNumber, setPortNumber] = useState("");
  const debouncedPortNumber = useDebounce(portNumber, 1000);
  const [systemEnv, setSystemEnv] = useState("");
  const debouncedSystemEnv = useDebounce(systemEnv, 1000);
  const [runtimeEnv, setRuntimeEnv] = useState("");
  const debouncedRuntimeEnv = useDebounce(runtimeEnv, 1000);
  const [pipelineId, setPipelineId] = useState("");
  const debouncedPipelineId = useDebounce(pipelineId, 1000);
  const [pipelineName, setPipelineName] = useState("");
  const debouncedPipelineName = useDebounce(pipelineName, 1000);
  const [pipelineVersion, setPipelineVersion] = useState("");
  const debouncedPipelineVersion = useDebounce(pipelineVersion, 1000);
  const [deployStatus, setDeployStatus] = useState("");
  const debouncedDeployStatus = useDebounce(deployStatus, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [instances, setInstances] = useState([]);

  const handleInstanceIdChange = (event) => {
    setInstanceId(event.target.value);
  };
  const handleInstanceNameChange = (event) => {
    setInstanceName(event.target.value);
  };
  const handleDeploymentInstanceIdChange = (event) => {
    setDeploymentInstanceId(event.target.value);
  };
  const handleServiceIdChange = (event) => {
    setServiceId(event.target.value);
  };
  const handleIpAddressChange = (event) => {
    setIpAddress(event.target.value);
  };
  const handlePortNumberChange = (event) => {
    setPortNumber(event.target.value);
  };
  const handleSystemEnvChange = (event) => {
    setSystemEnv(event.target.value);
  };
  const handleRuntimeEnvChange = (event) => {
    setRuntimeEnv(event.target.value);
  };
  const handlePipelineIdChange = (event) => {
    setPipelineId(event.target.value);
  };
  const handlePipelineNameChange = (event) => {
    setPipelineName(event.target.value);
  };
  const handlePipelineVersionChange = (event) => {
    setPipelineVersion(event.target.value);
  };
  const handleDeployStatusChange = (event) => {
    setDeployStatus(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setInstances([]);
      } else {
        const data = await response.json();
        console.log(data);
        setInstances(data.deploymentInstances);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "deployment",
      action: "getDeploymentInstance",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        instanceId: debouncedInstanceId,
        instanceName: debouncedInstanceName,
        deploymentInstanceId: debouncedDeploymentInstanceId,
        serviceId: debouncedServiceId,
        ipAddress: debouncedIpAddress,
        systemEnv: debouncedSystemEnv,
        runtimeEnv: debouncedRuntimeEnv,
        pipelineId: debouncedPipelineId,
        pipelineName: debouncedPipelineName,
        pipelineVersion: debouncedPipelineVersion,
        deployStatus: debouncedDeployStatus,
        ...(debouncedPortNumber && {
          portNumber: parseInt(debouncedPortNumber, 10),
        }),
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
    debouncedInstanceId,
    debouncedInstanceName,
    debouncedDeploymentInstanceId,
    debouncedServiceId,
    debouncedIpAddress,
    debouncedPortNumber,
    debouncedSystemEnv,
    debouncedRuntimeEnv,
    debouncedPipelineId,
    debouncedPipelineName,
    debouncedPipelineVersion,
    debouncedDeployStatus,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = (instanceId, serviceId) => {
    navigate("/app/form/createDeploymentInstance", {
      state: { data: { instanceId, serviceId } },
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
          <Table aria-label="instance table">
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
                    placeholder="Instance Name"
                    value={instanceName}
                    onChange={handleInstanceNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Deployment Instance Id"
                    value={deploymentInstanceId}
                    onChange={handleDeploymentInstanceIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Service Id"
                    value={serviceId}
                    onChange={handleServiceIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="IP Address"
                    value={ipAddress}
                    onChange={handleIpAddressChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Port Number"
                    value={portNumber}
                    onChange={handlePortNumberChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="System Env"
                    value={systemEnv}
                    onChange={handleSystemEnvChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Runtime Env"
                    value={runtimeEnv}
                    onChange={handleRuntimeEnvChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Pipeline Id"
                    value={pipelineId}
                    onChange={handlePipelineIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Pipeline Name"
                    value={pipelineName}
                    onChange={handlePipelineNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Pipeline Version"
                    value={pipelineVersion}
                    onChange={handlePipelineVersionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Deploy Status"
                    value={deployStatus}
                    onChange={handleDeployStatusChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Config</TableCell>
              </TableRow>
            </TableHead>
            <InstanceList instances={instances} />
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
        <AddBoxIcon onClick={() => handleCreate(instanceId, serviceId)} />
      </div>
    );
  }

  return <div className="DeploymentInstance">{content}</div>;
}
