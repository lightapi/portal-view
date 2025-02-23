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
    navigate("/app/form/updateInstance", { state: { data: { ...instance } } }); // Adjust path as needed
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this instance?")) {
      const cmd = {
        host: "lightapi.net", // Adjust if needed
        service: "instance", // Assuming "instance" service
        action: "deleteInstance", // Assuming "deleteInstance" action
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
    <TableRow className={classes.root} key={`${row.hostId}-${row.instanceId}`}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.instanceId}</TableCell>
      <TableCell align="left">{row.instanceName}</TableCell>
      <TableCell align="left">{row.productId}</TableCell>
      <TableCell align="left">{row.productVersion}</TableCell>
      <TableCell align="left">{row.serviceId}</TableCell>
      <TableCell align="left">{row.environment}</TableCell>
      <TableCell align="left">{row.pipelineId}</TableCell>
      <TableCell align="left">{row.serviceDesc}</TableCell>
      <TableCell align="left">{row.instanceDesc}</TableCell>
      <TableCell align="left">{row.tagId}</TableCell>
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
    instanceId: PropTypes.string.isRequired,
    instanceName: PropTypes.string,
    productId: PropTypes.string,
    productVersion: PropTypes.string,
    serviceId: PropTypes.string,
    environment: PropTypes.string,
    pipelineId: PropTypes.string,
    serviceDesc: PropTypes.string,
    instanceDesc: PropTypes.string,
    tagId: PropTypes.string,
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
            No instances found.
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
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [instanceId, setInstanceId] = useState("");
  const debouncedInstanceId = useDebounce(instanceId, 1000);
  const [instanceName, setInstanceName] = useState("");
  const debouncedInstanceName = useDebounce(instanceName, 1000);
  const [productId, setProductId] = useState("");
  const debouncedProductId = useDebounce(productId, 1000);
  const [productVersion, setProductVersion] = useState("");
  const debouncedProductVersion = useDebounce(productVersion, 1000);
  const [serviceId, setServiceId] = useState("");
  const debouncedServiceId = useDebounce(serviceId, 1000);
  const [environment, setEnvironment] = useState("");
  const debouncedEnvironment = useDebounce(environment, 1000);
  const [pipelineId, setPipelineId] = useState("");
  const debouncedPipelineId = useDebounce(pipelineId, 1000);
  const [serviceDesc, setServiceDesc] = useState("");
  const debouncedServiceDesc = useDebounce(serviceDesc, 1000);
  const [instanceDesc, setInstanceDesc] = useState("");
  const debouncedInstanceDesc = useDebounce(instanceDesc, 1000);
  const [tagId, setTagId] = useState("");
  const debouncedTagId = useDebounce(tagId, 1000);

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
  const handleProductIdChange = (event) => {
    setProductId(event.target.value);
  };
  const handleProductVersionChange = (event) => {
    setProductVersion(event.target.value);
  };
  const handleServiceIdChange = (event) => {
    setServiceId(event.target.value);
  };
  const handleEnvironmentChange = (event) => {
    setEnvironment(event.target.value);
  };
  const handlePipelineIdChange = (event) => {
    setPipelineId(event.target.value);
  };
  const handleServiceDescChange = (event) => {
    setServiceDesc(event.target.value);
  };
  const handleInstanceDescChange = (event) => {
    setInstanceDesc(event.target.value);
  };
  const handleTagIdChange = (event) => {
    setTagId(event.target.value);
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
        setInstances(data.instances); // Assuming response is data.instances
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
      host: "lightapi.net", // Adjust if needed
      service: "instance", // Assuming "instance" service
      action: "getInstance", // Action from service code
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        instanceId: debouncedInstanceId,
        instanceName: debouncedInstanceName,
        productId: debouncedProductId,
        productVersion: debouncedProductVersion,
        serviceId: debouncedServiceId,
        environment: debouncedEnvironment,
        pipelineId: debouncedPipelineId,
        serviceDesc: debouncedServiceDesc,
        instanceDesc: debouncedInstanceDesc,
        tagId: debouncedTagId,
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
    debouncedProductId,
    debouncedProductVersion,
    debouncedServiceId,
    debouncedEnvironment,
    debouncedPipelineId,
    debouncedServiceDesc,
    debouncedInstanceDesc,
    debouncedTagId,
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
    navigate("/app/form/createInstance"); // Adjust path as needed
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
                    placeholder="Product Id"
                    value={productId}
                    onChange={handleProductIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Product Version"
                    value={productVersion}
                    onChange={handleProductVersionChange}
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
                    placeholder="Environment"
                    value={environment}
                    onChange={handleEnvironmentChange}
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
                    placeholder="Service Desc"
                    value={serviceDesc}
                    onChange={handleServiceDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Instance Desc"
                    value={instanceDesc}
                    onChange={handleInstanceDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Tag Id"
                    value={tagId}
                    onChange={handleTagIdChange}
                  />
                </TableCell>

                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
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
        <AddBoxIcon onClick={() => handleCreate()} />
      </div>
    );
  }

  return <div className="InstanceAdmin">{content}</div>;
}
