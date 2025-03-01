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
import useDebounce from "../../hooks/useDebounce.js"; // Ensure you have this hook
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx"; // Ensure you have this context
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js"; // Assuming this exists

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

  const handleUpdate = (configInstanceApi) => {
    navigate("/app/form/updateConfigInstanceApi", {
      state: { data: { ...configInstanceApi } },
    }); // Adjust path
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete this config instance API property?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "config",
        action: "deleteConfigInstanceApi",
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command", // Adjust if your command endpoint is different
        headers: {},
        body: cmd,
      });

      if (result.data) {
        window.location.reload(); // Consider a state update instead of reload
      } else if (result.error) {
        console.error("API Error:", result.error);
        // Optionally show an error message to the user
      }
    }
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.instanceId}-${row.apiId}-${row.apiVersion}-${row.configId}-${row.propertyName}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.instanceId}</TableCell>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.apiVersion}</TableCell>
      <TableCell align="left">{row.configId}</TableCell>
      <TableCell align="left">{row.configName}</TableCell>
      <TableCell align="left">{row.propertyName}</TableCell>
      <TableCell align="left">{row.propertyValue}</TableCell>
      <TableCell align="left">{row.propertyFile}</TableCell>
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
    instanceId: PropTypes.string.isRequired,
    apiId: PropTypes.string.isRequired,
    apiVersion: PropTypes.string.isRequired,
    configId: PropTypes.string.isRequired,
    configName: PropTypes.string.isRequired,
    propertyName: PropTypes.string.isRequired,
    propertyValue: PropTypes.string,
    propertyFile: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ConfigInstanceApiList(props) {
  const { configInstanceApis } = props;
  return (
    <TableBody>
      {configInstanceApis && configInstanceApis.length > 0 ? (
        configInstanceApis.map((configInstanceApi, index) => (
          <Row key={index} row={configInstanceApi} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={12} align="center">
            {" "}
            {/*Adjust colSpan*/}
            No config instance API properties found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ConfigInstanceApiList.propTypes = {
  configInstanceApis: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ConfigInstanceApi() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;

  const { host } = useUserState(); // Get host from UserContext
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [instanceId, setInstanceId] = useState("");
  const debouncedInstanceId = useDebounce(instanceId, 1000);
  const [apiId, setApiId] = useState(() => data?.apiId || "");
  const debouncedApiId = useDebounce(apiId, 1000);
  const [apiVersion, setApiVersion] = useState(() => data?.apiVersion || "");
  const debouncedApiVersion = useDebounce(apiVersion, 1000);
  const [configId, setConfigId] = useState(() => data?.configId || "");
  const debouncedConfigId = useDebounce(configId, 1000);
  const [configName, setConfigName] = useState(""); // Not in the table, but in the spec
  const debouncedConfigName = useDebounce(configName, 1000);
  const [propertyName, setPropertyName] = useState("");
  const debouncedPropertyName = useDebounce(propertyName, 1000);
  const [propertyValue, setPropertyValue] = useState(""); // No debounce
  const [propertyFile, setPropertyFile] = useState(""); // No debounce

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [configInstanceApis, setConfigInstanceApis] = useState([]);

  const handleInstanceIdChange = (event) => {
    setInstanceId(event.target.value);
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
  const handlePropertyNameChange = (event) => {
    setPropertyName(event.target.value);
  };
  const handlePropertyValueChange = (event) => {
    setPropertyValue(event.target.value);
  };
  const handlePropertyFileChange = (event) => {
    setPropertyFile(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred.");
        setConfigInstanceApis([]);
      } else {
        const data = await response.json();
        setConfigInstanceApis(data.instanceApis || []); // Adjust to your response key
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setConfigInstanceApis([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "config",
      action: "getConfigInstanceApi",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        instanceId: debouncedInstanceId,
        apiId: debouncedApiId,
        apiVersion: debouncedApiVersion,
        configId: debouncedConfigId,
        configName: debouncedConfigName,
        propertyName: debouncedPropertyName,
        propertyValue: propertyValue,
        propertyFile: propertyFile,
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
    debouncedConfigId,
    debouncedConfigName,
    debouncedPropertyName,
    propertyValue,
    propertyFile,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreate = (apiId, apiVersion, configId) => {
    navigate("/app/form/createConfigInstanceApi", {
      state: { data: { apiId, apiVersion, configId } },
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
          <Table aria-label="config instance API table">
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
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Property File"
                    value={propertyFile}
                    onChange={handlePropertyFileChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ConfigInstanceApiList configInstanceApis={configInstanceApis} />
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
        <AddBoxIcon onClick={() => handleCreate(apiId, apiVersion, configId)} />
      </div>
    );
  }
  return <div className="ConfigInstanceApi">{content}</div>;
}
