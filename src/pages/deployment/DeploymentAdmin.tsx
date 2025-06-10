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
import useDebounce from "../../hooks/useDebounce.ts"; // Assuming this hook exists
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.tsx"; // Assuming this context exists
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.ts"; // Assuming this apiPost function exists

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

interface Deployment {
  hostId: string;
  deploymentId: string;
  deploymentInstanceId?: string;
  serviceId?: string;
  deploymentStatus?: string;
  deploymentType?: string;
  scheduleTs?: string;
  platformJobId?: string;
  updateUser?: string;
  updateTs?: string;
}

interface RowProps {
  row: Deployment;
}

function Row(props: RowProps): JSX.Element {
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (deployment: Deployment) => {
    navigate("/app/form/updateDeployment", {
      state: { data: { ...deployment } },
    }); // Adjust path as needed
  };

  const handleDelete = async (row: Deployment) => {
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
      <TableCell align="left">{row.deploymentInstanceId}</TableCell>
      <TableCell align="left">{row.serviceId}</TableCell>
      <TableCell align="left">{row.deploymentStatus}</TableCell>
      <TableCell align="left">{row.deploymentType}</TableCell>
      <TableCell align="left">{row.scheduleTs}</TableCell>
      <TableCell align="left">{row.platformJobId}</TableCell>
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
    deploymentInstanceId: PropTypes.string,
    serviceId: PropTypes.string,
    deploymentStatus: PropTypes.string,
    deploymentType: PropTypes.string,
    scheduleTs: PropTypes.string,
    platformJobId: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

interface DeploymentListProps {
  deployments: Deployment[];
}

function DeploymentList(props: DeploymentListProps): JSX.Element {
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

interface UserState {
  host?: string;
}

export default function DeploymentAdmin(): JSX.Element {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState() as UserState;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [deploymentId, setDeploymentId] = useState("");
  const debouncedDeploymentId = useDebounce(deploymentId, 1000);
  const [deploymentInstanceId, setDeploymentInstanceId] = useState("");
  const debouncedDeploymentInstanceId = useDebounce(deploymentInstanceId, 1000);
  const [serviceId, setServiceId] = useState("");
  const debouncedServiceId = useDebounce(serviceId, 1000);
  const [deploymentStatus, setDeploymentStatus] = useState("");
  const debouncedDeploymentStatus = useDebounce(deploymentStatus, 1000);
  const [deploymentType, setDeploymentType] = useState("");
  const debouncedDeploymentType = useDebounce(deploymentType, 1000);
  const [platformJobId, setPlatformJobId] = useState("");
  const debouncedPlatformJobId = useDebounce(platformJobId, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>();
  const [total, setTotal] = useState(0);
  const [deployments, setDeployments] = useState<Deployment[]>([]);

  const handleDeploymentIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDeploymentId(event.target.value);
  };
  const handleDeploymentInstanceIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDeploymentInstanceId(event.target.value);
  };
  const handleServiceIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setServiceId(event.target.value);
  };
  const handleDeploymentStatusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDeploymentStatus(event.target.value);
  };
  const handleDeploymentTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDeploymentType(event.target.value);
  };
  const handlePlatformJobIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPlatformJobId(event.target.value);
  };

  const fetchData = useCallback(async (url: string, headers: HeadersInit) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description);
        setDeployments([]);
      } else {
        const data = await response.json();
        console.log(data);
        setDeployments(data.deployments); // Assuming response is data.deployments
        setTotal(data.total);
      }
      setLoading(false);
    } catch (error: any) {
      console.log(error);
      setError(error);
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
        deploymentInstanceId: debouncedDeploymentInstanceId,
        deploymentStatus: debouncedDeploymentStatus,
        deploymentType: debouncedDeploymentType,
        platformJobId: debouncedPlatformJobId,
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
    debouncedDeploymentInstanceId,
    debouncedServiceId,
    debouncedDeploymentStatus,
    debouncedDeploymentType,
    debouncedPlatformJobId,
    fetchData,
  ]);

  const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
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
                    placeholder="Deployment Status"
                    value={deploymentStatus}
                    onChange={handleDeploymentStatusChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Deployment Type"
                    value={deploymentType}
                    onChange={handleDeploymentTypeChange}
                  />
                </TableCell>
                <TableCell align="left">Schedule Timestamp</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Platform Job Id"
                    value={platformJobId}
                    onChange={handlePlatformJobIdChange}
                  />
                </TableCell>
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
