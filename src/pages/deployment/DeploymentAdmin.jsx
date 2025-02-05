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
import useDebounce from "../../hooks/useDebounce.js"; // Assuming this hook exists
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx"; // Assuming this context exists
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js"; // Assuming this apiPost function exists
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

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

  const handleUpdate = (deployment) => {
    navigate("/app/form/updateDeployment", {
      state: { data: { ...deployment } },
    }); // Adjust path as needed
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this deployment?")) {
      const cmd = {
        host: "lightapi.net",
        service: "deployment",
        action: "deleteDeployment",
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
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.deploymentId}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.deploymentId}</TableCell>
      <TableCell align="left">{row.instanceId}</TableCell>
      <TableCell align="left">{row.deploymentStatus}</TableCell>
      <TableCell align="left">{row.deploymentType}</TableCell>
      <TableCell align="left">{row.pipelineId}</TableCell>
      <TableCell align="left">{row.scheduleTs}</TableCell>
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

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    deploymentId: PropTypes.string.isRequired,
    instanceId: PropTypes.string,
    deploymentStatus: PropTypes.string,
    deploymentType: PropTypes.string,
    pipelineId: PropTypes.string,
    scheduleTs: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function DeploymentList(props) {
  const { deployments } = props;
  return (
    <TableBody>
      {deployments && deployments.length > 0 ? (
        deployments.map((deployment, index) => (
          <Row key={index} row={deployment} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No deployments found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

DeploymentList.propTypes = {
  deployments: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function DeploymentAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [deploymentId, setDeploymentId] = useState("");
  const debouncedDeploymentId = useDebounce(deploymentId, 1000);
  const [instanceId, setInstanceId] = useState("");
  const debouncedInstanceId = useDebounce(instanceId, 1000);
  const [deploymentStatus, setDeploymentStatus] = useState("");
  const debouncedDeploymentStatus = useDebounce(deploymentStatus, 1000);
  const [deploymentType, setDeploymentType] = useState("");
  const debouncedDeploymentType = useDebounce(deploymentType, 1000);
  const [pipelineId, setPipelineId] = useState("");
  const debouncedPipelineId = useDebounce(pipelineId, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [deployments, setDeployments] = useState([]);

  const handleDeploymentIdChange = (event) => {
    setDeploymentId(event.target.value);
  };
  const handleInstanceIdChange = (event) => {
    setInstanceId(event.target.value);
  };
  const handleDeploymentStatusChange = (event) => {
    setDeploymentStatus(event.target.value);
  };
  const handleDeploymentTypeChange = (event) => {
    setDeploymentType(event.target.value);
  };
  const handlePipelineIdChange = (event) => {
    setPipelineId(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setDeployments([]);
      } else {
        const data = await response.json();
        console.log(data);
        setDeployments(data.deployments); // Assuming response is data.deployments
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setDeployments([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net", // Adjust if needed
      service: "deployment", // Assuming "deployment" service
      action: "getDeployment", // Action from service code
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        deploymentId: debouncedDeploymentId,
        instanceId: debouncedInstanceId,
        deploymentStatus: debouncedDeploymentStatus,
        deploymentType: debouncedDeploymentType,
        pipelineId: debouncedPipelineId,
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
    debouncedDeploymentId,
    debouncedInstanceId,
    debouncedDeploymentStatus,
    debouncedDeploymentType,
    debouncedPipelineId,
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
    navigate("/app/form/createDeployment"); // Adjust path as needed
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
          <Table aria-label="deployment table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Deployment Id"
                    value={deploymentId}
                    onChange={handleDeploymentIdChange}
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
                  <FormControl fullWidth variant="standard">
                    <InputLabel id="deployment-status-label">
                      Deployment Status
                    </InputLabel>
                    <Select
                      labelId="deployment-status-label"
                      id="deployment-status"
                      value={deploymentStatus}
                      onChange={handleDeploymentStatusChange}
                      label="Deployment Status"
                    >
                      <MenuItem value={""}> </MenuItem>
                      <MenuItem value={"PENDING"}>PENDING</MenuItem>
                      <MenuItem value={"DEPLOYED"}>DEPLOYED</MenuItem>
                      <MenuItem value={"FAILED"}>FAILED</MenuItem>
                      <MenuItem value={"DELETED"}>DELETED</MenuItem>
                      {/* Add more status options as needed */}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="left">
                  <FormControl fullWidth variant="standard">
                    <InputLabel id="deployment-type-label">
                      Deployment Type
                    </InputLabel>
                    <Select
                      labelId="deployment-type-label"
                      id="deployment-type"
                      value={deploymentType}
                      onChange={handleDeploymentTypeChange}
                      label="Deployment Type"
                    >
                      <MenuItem value={""}> </MenuItem>
                      <MenuItem value={"DOCKER"}>DOCKER</MenuItem>
                      <MenuItem value={"KUBERNETES"}>KUBERNETES</MenuItem>
                      <MenuItem value={"VM"}>VM</MenuItem>
                      {/* Add more type options as needed */}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Pipeline Id"
                    value={pipelineId}
                    onChange={handlePipelineIdChange}
                  />
                </TableCell>
                <TableCell align="left">Schedule Timestamp</TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <DeploymentList deployments={deployments} />
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

  return <div className="DeploymentAdmin">{content}</div>;
}
